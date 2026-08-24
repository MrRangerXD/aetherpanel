import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Folder, FileText, Upload, Plus, Download, Trash2, Edit3, Archive,
  FolderPlus, FilePlus, ChevronRight, CornerLeftUp, CheckSquare,
  Square, AlertTriangle, X, Loader2, ArrowRightLeft, Copy, RefreshCw,
  FileCode, FileArchive, CheckCircle2, AlertCircle
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';
import { ServerFile } from '../../types';

interface ServerFileManagerTabProps {
  serverId: string;
}

interface UploadTask {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export const ServerFileManagerTab: React.FC<ServerFileManagerTabProps> = ({ serverId }) => {
  const { toast } = useToast();

  // State
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [files, setFiles] = useState<ServerFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Multi-select
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);

  // Drag and Drop
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [showUploadDrawer, setShowUploadDrawer] = useState<boolean>(false);

  // Modals
  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');
  
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');

  const [renameTarget, setRenameTarget] = useState<ServerFile | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  const [deleteTargets, setDeleteTargets] = useState<ServerFile[] | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [moveCopyAction, setMoveCopyAction] = useState<{ mode: 'move' | 'copy'; sources: string[] } | null>(null);
  const [destDir, setDestDir] = useState<string>('/');
  const [conflictStrategy, setConflictStrategy] = useState<'replace' | 'rename' | 'skip'>('replace');
  const [isMovingOrCopying, setIsMovingOrCopying] = useState<boolean>(false);

  const [compressTargets, setCompressTargets] = useState<string[] | null>(null);
  const [archiveName, setArchiveName] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState<boolean>(false);

  // File Editor
  const [editingFile, setEditingFile] = useState<ServerFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
  const [isSavingContent, setIsSavingContent] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Fetch Directory Files
  const fetchFiles = useCallback(async (path: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiRequest(`/servers/${serverId}/files?path=${encodeURIComponent(path)}`);
      if (res.success) {
        const fileList = Array.isArray(res.data) ? res.data : (res.data?.files || []);
        setFiles(fileList);
      } else {
        setLoadError(res.error?.message || 'Failed to list directory contents.');
      }
    } catch (err: any) {
      setLoadError(err.message || 'Network error listing directory.');
    } finally {
      setLoading(false);
      setSelectedPaths([]);
    }
  }, [serverId]);

  useEffect(() => {
    fetchFiles(currentPath);
  }, [fetchFiles, currentPath]);

  // Format File Size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format Date
  const formatDate = (isoStr?: string): string => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '—';
    }
  };

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ name: 'root', path: '/' }];
    let acc = '';
    for (const part of parts) {
      acc += `/${part}`;
      crumbs.push({ name: part, path: acc });
    }
    return crumbs;
  }, [currentPath]);

  const navigateUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const parent = parts.length === 0 ? '/' : `/${parts.join('/')}`;
    setCurrentPath(parent);
  };

  // Selection Logic
  const allSelected = files.length > 0 && files.every(f => selectedPaths.includes(f.path));
  const someSelected = files.some(f => selectedPaths.includes(f.path)) && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedPaths([]);
    } else {
      setSelectedPaths(files.map(f => f.path));
    }
  };

  const toggleSelectPath = (path: string) => {
    setSelectedPaths(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  // Navigation into folder or open editor
  const handleItemClick = async (file: ServerFile) => {
    if (file.isDir) {
      const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
      setCurrentPath(newPath);
    } else {
      openFileEditor(file);
    }
  };

  // Open File Editor
  const openFileEditor = async (file: ServerFile) => {
    setEditingFile(file);
    setIsLoadingContent(true);
    try {
      const res = await apiRequest(`/servers/${serverId}/files/content?path=${encodeURIComponent(file.path)}`);
      if (res.success && res.data) {
        setFileContent(res.data.content || '');
      } else {
        toast.error(res.error?.message || 'Could not load file content.');
        setEditingFile(null);
      }
    } catch (err: any) {
      toast.error(`Failed to read file: ${err.message}`);
      setEditingFile(null);
    } finally {
      setIsLoadingContent(false);
    }
  };

  // Save File Editor
  const handleSaveFile = async () => {
    if (!editingFile) return;
    setIsSavingContent(true);
    try {
      const res = await apiRequest(`/servers/${serverId}/files/content`, {
        method: 'POST',
        body: JSON.stringify({ path: editingFile.path, content: fileContent })
      });
      if (res.success) {
        toast.success(`Saved '${editingFile.name}' successfully.`);
        fetchFiles(currentPath);
      } else {
        toast.error(res.error?.message || 'Failed to save file.');
      }
    } catch (err: any) {
      toast.error(`Save error: ${err.message}`);
    } finally {
      setIsSavingContent(false);
    }
  };

  // Create File
  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const name = newFileName.trim();
    const filePath = currentPath === '/' ? name : `${currentPath}/${name}`;

    try {
      const res = await apiRequest(`/servers/${serverId}/files/content`, {
        method: 'POST',
        body: JSON.stringify({ path: filePath, content: '' })
      });
      if (res.success) {
        toast.success(`Created file '${name}'.`);
        setNewFileName('');
        setShowNewFileModal(false);
        fetchFiles(currentPath);
      } else {
        toast.error(res.error?.message || 'Failed to create file.');
      }
    } catch (err: any) {
      toast.error(`Create error: ${err.message}`);
    }
  };

  // Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const name = newFolderName.trim();
    const folderPath = currentPath === '/' ? name : `${currentPath}/${name}`;

    try {
      const res = await apiRequest(`/servers/${serverId}/files/mkdir`, {
        method: 'POST',
        body: JSON.stringify({ path: folderPath })
      });
      if (res.success) {
        toast.success(`Created folder '${name}'.`);
        setNewFolderName('');
        setShowNewFolderModal(false);
        fetchFiles(currentPath);
      } else {
        toast.error(res.error?.message || 'Failed to create folder.');
      }
    } catch (err: any) {
      toast.error(`Create folder error: ${err.message}`);
    }
  };

  // Rename
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;
    const oldPath = renameTarget.path;
    const parentDir = currentPath === '/' ? '' : currentPath;
    const newPath = `${parentDir}/${renameValue.trim()}`.replace(/^\//, '');

    try {
      const res = await apiRequest(`/servers/${serverId}/files/rename`, {
        method: 'POST',
        body: JSON.stringify({ oldPath, newPath })
      });
      if (res.success) {
        toast.success(`Renamed to '${renameValue.trim()}'.`);
        setRenameTarget(null);
        setRenameValue('');
        fetchFiles(currentPath);
      } else {
        toast.error(res.error?.message || 'Failed to rename item.');
      }
    } catch (err: any) {
      toast.error(`Rename error: ${err.message}`);
    }
  };

  // Deletion Confirmation & Execution
  const executeDelete = async () => {
    if (!deleteTargets || deleteTargets.length === 0) return;
    setIsDeleting(true);

    const paths = deleteTargets.map(t => t.path);
    try {
      const res = await apiRequest(`/servers/${serverId}/files/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify({ paths })
      });

      if (res.success) {
        toast.success(res.message || `Deleted ${paths.length} item(s).`);
        setDeleteTargets(null);
        setSelectedPaths([]);
        fetchFiles(currentPath);
      } else {
        toast.error(res.error?.message || 'Failed to delete selected item(s).');
      }
    } catch (err: any) {
      toast.error(`Delete error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Move / Copy Execution
  const executeMoveOrCopy = async () => {
    if (!moveCopyAction) return;
    setIsMovingOrCopying(true);

    const endpoint = moveCopyAction.mode === 'move' ? 'move' : 'copy';
    try {
      const res = await apiRequest(`/servers/${serverId}/files/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({
          sources: moveCopyAction.sources,
          destinationDir: destDir,
          conflictStrategy
        })
      });

      if (res.success) {
        toast.success(res.message || `${moveCopyAction.mode === 'move' ? 'Moved' : 'Copied'} items successfully.`);
        setMoveCopyAction(null);
        setSelectedPaths([]);
        fetchFiles(currentPath);
      } else {
        toast.error(res.error?.message || `Failed to ${moveCopyAction.mode} items.`);
      }
    } catch (err: any) {
      toast.error(`Operation failed: ${err.message}`);
    } finally {
      setIsMovingOrCopying(false);
    }
  };

  // Compress Execution
  const executeCompress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compressTargets || compressTargets.length === 0) return;
    setIsCompressing(true);

    try {
      const res = await apiRequest(`/servers/${serverId}/files/compress`, {
        method: 'POST',
        body: JSON.stringify({
          paths: compressTargets,
          outputName: archiveName || undefined,
          currentDir: currentPath
        })
      });

      if (res.success) {
        toast.success('Compressed into ZIP archive.');
        setCompressTargets(null);
        setArchiveName('');
        setSelectedPaths([]);
        fetchFiles(currentPath);
      } else {
        toast.error(res.error?.message || 'Compression failed.');
      }
    } catch (err: any) {
      toast.error(`Compression error: ${err.message}`);
    } finally {
      setIsCompressing(false);
    }
  };

  // Decompress Execution
  const handleDecompress = async (file: ServerFile) => {
    try {
      const res = await apiRequest(`/servers/${serverId}/files/decompress`, {
        method: 'POST',
        body: JSON.stringify({
          path: file.path,
          destinationDir: currentPath
        })
      });

      if (res.success) {
        toast.success(`Extracted '${file.name}' successfully.`);
        fetchFiles(currentPath);
      } else {
        toast.error(res.error?.message || 'Failed to extract archive.');
      }
    } catch (err: any) {
      toast.error(`Decompression error: ${err.message}`);
    }
  };

  // Upload Management
  const processUploadQueue = async (tasks: UploadTask[]) => {
    setShowUploadDrawer(true);
    const token = localStorage.getItem('aether_token');

    for (const task of tasks) {
      if (task.status === 'completed') continue;

      setUploadTasks(prev =>
        prev.map(t => t.id === task.id ? { ...t, status: 'uploading', progress: 30 } : t)
      );

      const formData = new FormData();
      formData.append('files', task.file);

      try {
        setUploadTasks(prev =>
          prev.map(t => t.id === task.id ? { ...t, progress: 70 } : t)
        );

        const res = await fetch(`/api/v1/servers/${serverId}/files/upload?path=${encodeURIComponent(currentPath)}`, {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          body: formData
        });

        const data = await res.json();
        if (data.success) {
          setUploadTasks(prev =>
            prev.map(t => t.id === task.id ? { ...t, status: 'completed', progress: 100 } : t)
          );
        } else {
          setUploadTasks(prev =>
            prev.map(t => t.id === task.id ? { ...t, status: 'error', error: data.error?.message || 'Upload failed' } : t)
          );
        }
      } catch (err: any) {
        setUploadTasks(prev =>
          prev.map(t => t.id === task.id ? { ...t, status: 'error', error: err.message || 'Upload error' } : t)
        );
      }
    }

    fetchFiles(currentPath);
  };

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const newTasks: UploadTask[] = Array.from(fileList).map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending'
    }));

    setUploadTasks(prev => [...newTasks, ...prev]);
    processUploadQueue(newTasks);

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  // Drag and Drop Event Listeners
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  // Download File
  const handleDownload = (file: ServerFile) => {
    const token = localStorage.getItem('aether_token');
    const url = `/api/v1/servers/${serverId}/files/download?path=${encodeURIComponent(file.path)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Available directories for Move/Copy picker
  const availableDirs = useMemo(() => {
    return ['/', ...files.filter(f => f.isDir).map(f => currentPath === '/' ? `/${f.name}` : `${currentPath}/${f.name}`)];
  }, [files, currentPath]);

  // Selected files list
  const selectedFilesList = files.filter(f => selectedPaths.includes(f.path));

  // Determine file icon
  const getFileIcon = (file: ServerFile) => {
    if (file.isDir) return <Folder className="h-4 w-4 text-amber-400 shrink-0" />;
    const ext = file.extension?.toLowerCase();
    if (ext === '.zip' || ext === '.tar' || ext === '.gz') {
      return <FileArchive className="h-4 w-4 text-emerald-400 shrink-0" />;
    }
    if (['.json', '.yml', '.yaml', '.properties', '.toml', '.env', '.sh'].includes(ext || '')) {
      return <FileCode className="h-4 w-4 text-violet-400 shrink-0" />;
    }
    return <FileText className="h-4 w-4 text-zinc-400 shrink-0" />;
  };

  return (
    <div
      id="server-file-manager"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative space-y-4 min-h-[500px]"
    >
      {/* Visual Drop Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-40 bg-amber-500/15 backdrop-blur-xs border-2 border-dashed border-amber-400 rounded-3xl flex flex-col items-center justify-center pointer-events-none p-6 animate-in fade-in">
          <Upload className="h-12 w-12 text-amber-400 animate-bounce mb-2" />
          <h3 className="text-lg font-bold text-white">Drop files here to upload</h3>
          <p className="text-xs text-amber-200 mt-1">Files will be uploaded directly into {currentPath}</p>
        </div>
      )}

      {/* Hidden File / Folder Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => handleFilesSelected(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-ignore
        webkitdirectory=""
        className="hidden"
        onChange={e => handleFilesSelected(e.target.files)}
      />

      {/* Action Bar & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-2xl">
        {/* Breadcrumb Path */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono py-1 max-w-full">
          {currentPath !== '/' && (
            <button
              id="file-manager-nav-up"
              onClick={navigateUp}
              className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg mr-1 cursor-pointer transition-colors"
              title="Go up one folder"
            >
              <CornerLeftUp className="h-3.5 w-3.5" />
            </button>
          )}

          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.path}>
              {idx > 0 && <ChevronRight className="h-3 w-3 text-zinc-600 shrink-0" />}
              <button
                onClick={() => setCurrentPath(crumb.path)}
                className={`px-2 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  idx === breadcrumbs.length - 1
                    ? 'text-amber-400 font-bold bg-amber-400/10'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="file-manager-refresh-btn"
            onClick={() => fetchFiles(currentPath)}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh Directory"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            id="file-manager-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-amber-950/20 transition-colors cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload</span>
          </button>

          <button
            id="file-manager-new-file-btn"
            onClick={() => setShowNewFileModal(true)}
            className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FilePlus className="h-3.5 w-3.5 text-zinc-400" />
            <span>New File</span>
          </button>

          <button
            id="file-manager-new-folder-btn"
            onClick={() => setShowNewFolderModal(true)}
            className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FolderPlus className="h-3.5 w-3.5 text-amber-400" />
            <span>New Folder</span>
          </button>

          {uploadTasks.length > 0 && (
            <button
              onClick={() => setShowUploadDrawer(prev => !prev)}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1.5 relative transition-colors cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Transfers ({uploadTasks.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-Selection Bulk Action Bar */}
      {selectedPaths.length > 0 && (
        <div
          id="file-manager-bulk-toolbar"
          className="p-3 sm:p-4 rounded-2xl bg-zinc-900 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-amber-950/10 animate-in fade-in"
        >
          <div className="flex items-center gap-2.5 text-xs text-zinc-200">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-bold">
              {selectedPaths.length}
            </span>
            <span>{selectedPaths.length === 1 ? 'item selected' : 'items selected'}</span>
            <button
              onClick={() => setSelectedPaths([])}
              className="text-zinc-400 hover:text-white underline ml-1 cursor-pointer text-xs"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setMoveCopyAction({ mode: 'move', sources: selectedPaths });
                setDestDir(currentPath);
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-amber-400" />
              <span>Move</span>
            </button>

            <button
              onClick={() => {
                setMoveCopyAction({ mode: 'copy', sources: selectedPaths });
                setDestDir(currentPath);
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5 text-violet-400" />
              <span>Copy</span>
            </button>

            <button
              onClick={() => {
                setCompressTargets(selectedPaths);
                setArchiveName(`archive_${Date.now()}.zip`);
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Archive className="h-3.5 w-3.5 text-emerald-400" />
              <span>Compress ZIP</span>
            </button>

            <button
              onClick={() => setDeleteTargets(selectedFilesList)}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-rose-950/20 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Main File Table / List */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-zinc-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
            <span>Loading directory contents...</span>
          </div>
        ) : loadError ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
            <p className="text-xs text-rose-300">{loadError}</p>
            <button
              onClick={() => fetchFiles(currentPath)}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : files.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center mx-auto text-zinc-500">
              <Folder className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">This folder is empty</h3>
              <p className="text-xs text-zinc-500 mt-1">Upload files or create new items to get started.</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Files</span>
              </button>
              <button
                onClick={() => setShowNewFileModal(true)}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <FilePlus className="h-3.5 w-3.5" />
                <span>New File</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Mobile Cards View (< sm screens) */}
            <div className="sm:hidden divide-y divide-zinc-800/80">
              <div className="p-3 bg-zinc-950/80 flex items-center justify-between border-b border-zinc-800">
                <button
                  id="file-manager-select-all-mobile"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-xs text-zinc-300 font-medium cursor-pointer"
                >
                  {allSelected ? (
                    <CheckSquare className="h-4 w-4 text-amber-400" />
                  ) : someSelected ? (
                    <div className="h-4 w-4 rounded bg-amber-400/30 border border-amber-400 flex items-center justify-center">
                      <div className="h-1.5 w-2 bg-amber-400 rounded-xs" />
                    </div>
                  ) : (
                    <Square className="h-4 w-4 text-zinc-500" />
                  )}
                  <span>Select All</span>
                </button>
                <span className="text-[11px] text-zinc-500 font-mono">{files.length} items</span>
              </div>

              {files.map((file) => {
                const isSelected = selectedPaths.includes(file.path);
                const isZip = file.extension?.toLowerCase() === '.zip';

                return (
                  <div
                    key={file.path}
                    className={`p-3.5 space-y-2.5 transition-colors ${
                      isSelected ? 'bg-amber-500/10' : 'hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <button
                          onClick={() => toggleSelectPath(file.path)}
                          className="mt-0.5 p-1 text-zinc-400 hover:text-white rounded cursor-pointer"
                          aria-label={`Select ${file.name}`}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-amber-400" />
                          ) : (
                            <Square className="h-4 w-4 text-zinc-500" />
                          )}
                        </button>
                        <div
                          onClick={() => handleItemClick(file)}
                          className="flex items-start gap-2 cursor-pointer min-w-0 flex-1"
                        >
                          <div className="mt-0.5">{getFileIcon(file)}</div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs break-all font-medium leading-tight ${file.isDir ? 'text-amber-300 font-bold' : 'text-zinc-200'}`}>
                              {file.name}
                            </p>
                            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                              {file.isDir ? 'Folder' : formatSize(file.size)} • {formatDate(file.updatedAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Action Row with 44px min tap targets */}
                    <div className="flex items-center justify-end gap-1 pt-1 border-t border-zinc-800/40">
                      {!file.isDir && (
                        <button
                          onClick={() => handleDownload(file)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-zinc-800/80 text-zinc-300 active:bg-zinc-700 transition-colors"
                          title="Download File"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      )}

                      {isZip && (
                        <button
                          onClick={() => handleDecompress(file)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 active:bg-emerald-500/20 transition-colors"
                          title="Extract ZIP Archive"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setRenameTarget(file);
                          setRenameValue(file.name);
                        }}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-zinc-800/80 text-zinc-300 active:bg-zinc-700 transition-colors"
                        title="Rename"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => setDeleteTargets([file])}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 active:bg-rose-500/20 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop / Tablet Table View (>= sm screens) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                  <tr>
                    <th className="p-3.5 w-10 text-center">
                      <button
                        id="file-manager-select-all-btn"
                        onClick={toggleSelectAll}
                        className="p-1 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
                        aria-label={allSelected ? 'Deselect all files' : 'Select all files'}
                      >
                        {allSelected ? (
                          <CheckSquare className="h-4 w-4 text-amber-400" />
                        ) : someSelected ? (
                          <div className="h-4 w-4 rounded bg-amber-400/30 border border-amber-400 flex items-center justify-center">
                            <div className="h-1.5 w-2 bg-amber-400 rounded-xs" />
                          </div>
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-3.5">Name</th>
                    <th className="p-3.5">Size</th>
                    <th className="p-3.5">Last Modified</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {files.map((file) => {
                    const isSelected = selectedPaths.includes(file.path);
                    const isZip = file.extension?.toLowerCase() === '.zip';

                    return (
                      <tr
                        key={file.path}
                        className={`transition-colors ${
                          isSelected ? 'bg-amber-500/10' : 'hover:bg-zinc-900/80'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => toggleSelectPath(file.path)}
                            className="p-1 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
                            aria-label={`Select ${file.name}`}
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-amber-400" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </td>

                        {/* Name & Type */}
                        <td className="p-3.5 font-sans">
                          <div
                            onClick={() => handleItemClick(file)}
                            className="flex items-center gap-2.5 cursor-pointer text-zinc-200 hover:text-white group"
                          >
                            {getFileIcon(file)}
                            <span className={`text-xs ${file.isDir ? 'font-semibold text-amber-300 group-hover:text-amber-200' : 'text-zinc-200'}`}>
                              {file.name}
                            </span>
                          </div>
                        </td>

                        {/* Size */}
                        <td className="p-3.5 text-zinc-400 text-[11px]">
                          {file.isDir ? '—' : formatSize(file.size)}
                        </td>

                        {/* Date */}
                        <td className="p-3.5 text-zinc-400 text-[11px]">
                          {formatDate(file.updatedAt)}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            {!file.isDir && (
                              <button
                                onClick={() => handleDownload(file)}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                title="Download File"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {isZip && (
                              <button
                                onClick={() => handleDecompress(file)}
                                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer"
                                title="Extract ZIP Archive"
                              >
                                <Archive className="h-3.5 w-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setRenameTarget(file);
                                setRenameValue(file.name);
                              }}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              title="Rename"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>

                            <button
                              onClick={() => setDeleteTargets([file])}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Upload Tasks Drawer */}
      {showUploadDrawer && uploadTasks.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-4 space-y-3 animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Upload className="h-4 w-4 text-amber-400" /> Upload Activity
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUploadTasks(prev => prev.filter(t => t.status === 'uploading'))}
                className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
              >
                Clear Done
              </button>
              <button
                onClick={() => setShowUploadDrawer(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 font-mono text-xs">
            {uploadTasks.map(t => (
              <div key={t.id} className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white truncate max-w-[180px]">{t.name}</span>
                  <span className="text-zinc-500">{formatSize(t.size)}</span>
                </div>

                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      t.status === 'completed'
                        ? 'bg-emerald-500'
                        : t.status === 'error'
                        ? 'bg-rose-500'
                        : 'bg-amber-400'
                    }`}
                    style={{ width: `${t.progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <span className={
                    t.status === 'completed' ? 'text-emerald-400' :
                    t.status === 'error' ? 'text-rose-400' : 'text-amber-400'
                  }>
                    {t.status === 'completed' ? 'Uploaded' : t.status === 'error' ? (t.error || 'Failed') : 'Uploading...'}
                  </span>
                  {t.status === 'error' && (
                    <button
                      onClick={() => processUploadQueue([t])}
                      className="text-amber-400 hover:underline cursor-pointer"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Editor Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-5 max-w-4xl w-full h-[85vh] flex flex-col space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">{editingFile.name}</h3>
                  <p className="text-[10px] font-mono text-zinc-500">{editingFile.path}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveFile}
                  disabled={isSavingContent}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingContent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>Save</span>
                </button>
                <button
                  onClick={() => setEditingFile(null)}
                  className="p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-800 hover:bg-zinc-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden relative">
              {isLoadingContent ? (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
                  <span>Loading file content...</span>
                </div>
              ) : (
                <textarea
                  value={fileContent}
                  onChange={e => setFileContent(e.target.value)}
                  className="w-full h-full p-4 bg-transparent font-mono text-xs text-zinc-200 resize-none focus:outline-none leading-relaxed"
                  placeholder="File is empty..."
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Single & Bulk) */}
      {deleteTargets && deleteTargets.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-rose-500/30 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {deleteTargets.length === 1 ? 'Delete Item' : `Delete ${deleteTargets.length} Items`}
                  </h3>
                  <p className="text-xs text-zinc-400">Irreversible File Operation</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteTargets(null)}
                className="text-zinc-500 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              {deleteTargets.length === 1 ? (
                <strong>'{deleteTargets[0].name}'</strong>
              ) : (
                <strong>{deleteTargets.length} selected items</strong>
              )}?
            </p>

            {deleteTargets.some(t => t.isDir) && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>Warning: Deleting a folder will permanently delete all of its contents.</span>
              </div>
            )}

            <div className="max-h-36 overflow-y-auto p-3 bg-zinc-950 rounded-2xl border border-zinc-800 divide-y divide-zinc-850 font-mono text-xs">
              {deleteTargets.map(t => (
                <div key={t.path} className="py-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-white truncate max-w-[220px]">{t.name}</span>
                  <span className="text-zinc-500">{t.isDir ? 'Folder' : formatSize(t.size)}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTargets(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-950/30 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move & Copy Destination Modal */}
      {moveCopyAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {moveCopyAction.mode === 'move' ? (
                  <ArrowRightLeft className="h-5 w-5 text-amber-400" />
                ) : (
                  <Copy className="h-5 w-5 text-violet-400" />
                )}
                <span>{moveCopyAction.mode === 'move' ? 'Move' : 'Copy'} {moveCopyAction.sources.length} Item(s)</span>
              </h3>
              <button
                onClick={() => setMoveCopyAction(null)}
                className="text-zinc-500 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Destination Directory</label>
                <input
                  type="text"
                  value={destDir}
                  onChange={e => setDestDir(e.target.value)}
                  placeholder="/ or /plugins"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              {availableDirs.length > 1 && (
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">Quick Select Folder:</label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableDirs.map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDestDir(d)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-mono border cursor-pointer ${
                          destDir === d
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-white'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Conflict Resolution</label>
                <select
                  value={conflictStrategy}
                  onChange={e => setConflictStrategy(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="replace">Overwrite / Replace existing</option>
                  <option value="rename">Keep Both (auto-rename with counter)</option>
                  <option value="skip">Skip conflicting files</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setMoveCopyAction(null)}
                disabled={isMovingOrCopying}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeMoveOrCopy}
                disabled={isMovingOrCopying}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-amber-950/20 cursor-pointer disabled:opacity-50"
              >
                {isMovingOrCopying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : moveCopyAction.mode === 'move' ? (
                  <ArrowRightLeft className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span>Confirm {moveCopyAction.mode === 'move' ? 'Move' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compress ZIP Modal */}
      {compressTargets && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <form onSubmit={executeCompress} className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Archive className="h-5 w-5 text-emerald-400" />
                <span>Compress {compressTargets.length} Item(s)</span>
              </h3>
              <button
                type="button"
                onClick={() => setCompressTargets(null)}
                className="text-zinc-500 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Archive Filename (.zip)</label>
              <input
                type="text"
                value={archiveName}
                onChange={e => setArchiveName(e.target.value)}
                placeholder="archive.zip"
                autoFocus
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCompressTargets(null)}
                disabled={isCompressing}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCompressing}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/20 cursor-pointer disabled:opacity-50"
              >
                {isCompressing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                <span>Create ZIP</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <form onSubmit={handleCreateFile} className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FilePlus className="h-5 w-5 text-amber-400" />
                <span>Create New File</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewFileModal(false)}
                className="text-zinc-500 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">File Name</label>
              <input
                type="text"
                value={newFileName}
                onChange={e => setNewFileName(e.target.value)}
                placeholder="server.properties"
                autoFocus
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-zinc-500 mt-1">Will be created in {currentPath}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNewFileModal(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newFileName.trim()}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-amber-950/20 cursor-pointer disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>Create File</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <form onSubmit={handleCreateFolder} className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-amber-400" />
                <span>Create New Folder</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="text-zinc-500 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Folder Name</label>
              <input
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="plugins"
                autoFocus
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-zinc-500 mt-1">Will be created in {currentPath}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newFolderName.trim()}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-amber-950/20 cursor-pointer disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>Create Folder</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <form onSubmit={handleRename} className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-amber-400" />
                <span>Rename Item</span>
              </h3>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="text-zinc-500 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">New Name</label>
              <input
                type="text"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                autoFocus
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!renameValue.trim() || renameValue.trim() === renameTarget.name}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-amber-950/20 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Rename</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
