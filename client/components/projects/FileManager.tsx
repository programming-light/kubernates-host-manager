'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@/components/ui/modal';
import { Loader2, Folder, File, FileText, ArrowLeft, Upload, Download, Trash2, Plus, Edit3, Save, X, ChevronRight, FileCode, Image, FileArchive, Music, Video } from 'lucide-react';
import { toast } from 'sonner';

interface FileEntry {
  name: string;
  permissions: string;
  owner: string;
  group: string;
  size: number;
  isDirectory: boolean;
  isSymlink: boolean;
  path: string;
}

interface FileManagerProps {
  projectId: string;
}

const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

const getFileIcon = (name: string, isDir: boolean) => {
  if (isDir) return <Folder className="h-4 w-4 text-yellow-400" />;
  const ext = name.split('.').pop()?.toLowerCase();
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'php', 'c', 'cpp', 'h', 'cs', 'swift'].includes(ext || '')) return <FileCode className="h-4 w-4 text-blue-400" />;
  if (['json', 'xml', 'yaml', 'yml', 'toml', 'env', 'config', 'md', 'txt', 'csv'].includes(ext || '')) return <FileText className="h-4 w-4 text-gray-400" />;
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'].includes(ext || '')) return <Image className="h-4 w-4 text-purple-400" />;
  if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar'].includes(ext || '')) return <FileArchive className="h-4 w-4 text-orange-400" />;
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext || '')) return <Music className="h-4 w-4 text-pink-400" />;
  if (['mp4', 'avi', 'mkv', 'mov'].includes(ext || '')) return <Video className="h-4 w-4 text-red-400" />;
  return <File className="h-4 w-4 text-gray-400" />;
};

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
};

export default function FileManager({ projectId }: FileManagerProps) {
  const [currentPath, setCurrentPath] = useState('/app');
  const [baseDir, setBaseDir] = useState('/app');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFile, setEditingFile] = useState<{ path: string; content: string; name: string } | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewDir, setShowNewDir] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newDirName, setNewDirName] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ path: string; name: string; isDir: boolean } | null>(null);
  const [pods, setPods] = useState<string[]>([]);
  const [noPod, setNoPod] = useState(false);

  useEffect(() => {
    checkPods();
  }, [projectId]);

  useEffect(() => {
    if (pods.length > 0) {
      loadFiles(currentPath);
    }
  }, [pods, currentPath]);

  const checkPods = async () => {
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/pods`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPods(data.map((p: any) => p.name));
        if (data.length === 0) { setNoPod(true); setLoading(false); return; }
        const workdirRes = await fetch(`${baseUrl}/container/${projectId}/exec`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ command: 'pwd' }),
        });
        if (workdirRes.ok) {
          const wd = await workdirRes.json();
          const dir = (wd.stdout || '/app').trim();
          setCurrentPath(dir);
          setBaseDir(dir);
        }
      } else {
        setNoPod(true);
      }
    } catch {
      setNoPod(true);
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/files?path=${encodeURIComponent(path)}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      } else {
        toast.error('Failed to load files');
        setEntries([]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load files');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (path: string) => {
    setCurrentPath(path);
  };

  const navigateUp = () => {
    if (currentPath === '/') return;
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    setCurrentPath(parent);
  };

  const openFile = async (entry: FileEntry) => {
    if (entry.isDirectory) {
      navigateTo(entry.path);
      return;
    }
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/files/read?path=${encodeURIComponent(entry.path)}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEditingFile({ path: entry.path, content: data.content, name: entry.name });
        setEditContent(data.content);
      } else {
        toast.error('Failed to read file');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to read file');
    }
  };

  const saveFile = async () => {
    if (!editingFile) return;
    setSaving(true);
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: editingFile.path, content: editContent }),
      });
      if (res.ok) {
        toast.success('File saved');
        setEditingFile(null);
        loadFiles(currentPath);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to save file');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const createFile = async () => {
    if (!newFileName.trim()) return;
    const fullPath = currentPath === '/' ? `/${newFileName}` : `${currentPath}/${newFileName}`;
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: fullPath, content: '' }),
      });
      if (res.ok) {
        toast.success('File created');
        setShowNewFile(false);
        setNewFileName('');
        loadFiles(currentPath);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to create file');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create file');
    }
  };

  const createDir = async () => {
    if (!newDirName.trim()) return;
    const fullPath = currentPath === '/' ? `/${newDirName}` : `${currentPath}/${newDirName}`;
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/files/mkdir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: fullPath }),
      });
      if (res.ok) {
        toast.success('Directory created');
        setShowNewDir(false);
        setNewDirName('');
        loadFiles(currentPath);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to create directory');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create directory');
    }
  };

  const uploadFile = async () => {
    if (!uploadFileName.trim() || !uploadContent.trim()) return;
    const fullPath = currentPath === '/' ? `/${uploadFileName}` : `${currentPath}/${uploadFileName}`;
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: fullPath, content: uploadContent, fileName: uploadFileName }),
      });
      if (res.ok) {
        toast.success('File uploaded');
        setShowUpload(false);
        setUploadFileName('');
        setUploadContent('');
        loadFiles(currentPath);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to upload file');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload file');
    }
  };

  const deleteEntry = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/files/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: deleteConfirm.path, recursive: deleteConfirm.isDir }),
      });
      if (res.ok) {
        toast.success(`${deleteConfirm.isDir ? 'Directory' : 'File'} deleted`);
        setDeleteConfirm(null);
        loadFiles(currentPath);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to delete');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  if (noPod) {
    return (
      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-blue-400" />
            <CardTitle className="text-white">File Manager</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Folder className="mb-3 h-10 w-10 text-gray-600" />
            <p className="text-gray-500 text-sm">No running pods</p>
            <p className="text-xs text-gray-600 mt-1">Deploy your project to access the file manager</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-700">
                <Folder className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-base">File Manager</CardTitle>
                <p className="text-xs text-gray-500">{entries.length} item{entries.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setShowNewFile(true)} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800" title="New File">
                <FileText className="h-4 w-4" />
              </button>
              <button onClick={() => setShowNewDir(true)} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800" title="New Directory">
                <Folder className="h-4 w-4" />
              </button>
              <button onClick={() => setShowUpload(true)} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800" title="Upload File">
                <Upload className="h-4 w-4" />
              </button>
              <button onClick={() => loadFiles(currentPath)} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800" title="Refresh">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs font-mono text-gray-500">
            <button onClick={() => navigateTo('/')} className="hover:text-white">/</button>
            {pathParts.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                {i < pathParts.length - 1 ? (
                  <button onClick={() => navigateTo('/' + pathParts.slice(0, i + 1).join('/'))} className="hover:text-white">{part}</button>
                ) : (
                  <span className="text-gray-300">{part}</span>
                )}
              </span>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Folder className="mb-2 h-8 w-8 text-gray-600" />
              <p className="text-gray-500 text-sm">Empty directory</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {currentPath !== '/' && (
                <button onClick={navigateUp} className="flex w-full items-center gap-3 rounded px-3 py-2 text-gray-400 hover:bg-gray-800/50 text-sm">
                  <ArrowLeft className="h-4 w-4" />
                  <span>.. (parent directory)</span>
                </button>
              )}
              {entries.map((entry, i) => (
                <div key={i}
                  className="group flex items-center justify-between rounded px-3 py-2 hover:bg-gray-800/50 cursor-pointer"
                  onClick={() => openFile(entry)}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {getFileIcon(entry.name, entry.isDirectory)}
                    <span className="text-sm text-gray-200 truncate">{entry.name}</span>
                    {entry.isSymlink && <span className="text-xs text-yellow-500">→ symlink</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="hidden sm:inline font-mono">{entry.permissions}</span>
                    <span className="hidden md:inline">{entry.owner}:{entry.group}</span>
                    <span className="w-16 text-right">{formatSize(entry.size)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ path: entry.path, name: entry.name, isDir: entry.isDirectory }); }}
                      className="p-1 rounded text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={!!editingFile} onOpenChange={(open) => { if (!open) setEditingFile(null); }}>
        <ModalContent className="max-w-4xl">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-blue-400" />
              Editing: {editingFile?.name}
            </ModalTitle>
            <ModalDescription className="text-xs font-mono text-gray-500">{editingFile?.path}</ModalDescription>
          </ModalHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[300px] bg-gray-950 text-gray-200 font-mono text-sm p-4 border border-gray-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
              spellCheck={false}
            />
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setEditingFile(null)} className="border-gray-700 text-gray-300 hover:bg-gray-800">
              <X className="h-4 w-4 mr-2" /> Cancel
            </Button>
            <Button onClick={saveFile} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save File
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={showNewFile} onOpenChange={setShowNewFile}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Create New File</ModalTitle>
            <ModalDescription>Enter the filename to create in {currentPath}</ModalDescription>
          </ModalHeader>
          <div className="p-4">
            <Input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="filename.txt"
              className="bg-gray-800 border-gray-700 text-white"
              onKeyDown={(e) => e.key === 'Enter' && createFile()}
              autoFocus
            />
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowNewFile(false)} className="border-gray-700">Cancel</Button>
            <Button onClick={createFile} className="bg-blue-600 hover:bg-blue-700" disabled={!newFileName.trim()}>Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={showNewDir} onOpenChange={setShowNewDir}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Create New Directory</ModalTitle>
            <ModalDescription>Enter the directory name to create in {currentPath}</ModalDescription>
          </ModalHeader>
          <div className="p-4">
            <Input
              value={newDirName}
              onChange={(e) => setNewDirName(e.target.value)}
              placeholder="my-folder"
              className="bg-gray-800 border-gray-700 text-white"
              onKeyDown={(e) => e.key === 'Enter' && createDir()}
              autoFocus
            />
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowNewDir(false)} className="border-gray-700">Cancel</Button>
            <Button onClick={createDir} className="bg-blue-600 hover:bg-blue-700" disabled={!newDirName.trim()}>Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={showUpload} onOpenChange={setShowUpload}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Upload File</ModalTitle>
            <ModalDescription>Upload a file to {currentPath}</ModalDescription>
          </ModalHeader>
          <div className="p-4 space-y-4">
            <Input
              value={uploadFileName}
              onChange={(e) => setUploadFileName(e.target.value)}
              placeholder="filename.txt"
              className="bg-gray-800 border-gray-700 text-white"
            />
            <textarea
              value={uploadContent}
              onChange={(e) => setUploadContent(e.target.value)}
              placeholder="Paste file content here..."
              className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
            />
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)} className="border-gray-700">Cancel</Button>
            <Button onClick={uploadFile} className="bg-green-600 hover:bg-green-700" disabled={!uploadFileName.trim() || !uploadContent.trim()}>
              <Upload className="h-4 w-4 mr-2" /> Upload
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Delete {deleteConfirm?.isDir ? 'Directory' : 'File'}</ModalTitle>
            <ModalDescription>
              Are you sure you want to delete <strong className="text-white">{deleteConfirm?.name}</strong>?
              {deleteConfirm?.isDir && ' This will recursively delete all contents.'}
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-gray-700">Cancel</Button>
            <Button onClick={deleteEntry} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
