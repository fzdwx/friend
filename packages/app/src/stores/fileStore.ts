/**
 * File system state management
 * Handles file tree browsing and file content viewing
 */

import { create } from "zustand";

// ─── Types ─────────────────────────────────────────────────────

export interface FileTreeItem {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modified?: Date;
  children?: FileTreeItem[];
  loading?: boolean;
}

export interface FileContent {
  path: string;
  name: string;
  content: string;
  size: number;
  modified: Date;
  language: string;
}

export interface SearchResult {
  path: string;
  name: string;
  size: number;
  modified: Date;
  language: string;
}

// ─── State Interface ────────────────────────────────────────────

interface FileState {
  // File tree state
  tree: FileTreeItem[];
  treeLoading: boolean;
  treeError: string | null;
  expandedPaths: Set<string>;
  
  // Current file being viewed
  currentFile: FileContent | null;
  fileLoading: boolean;
  fileError: string | null;
  
  // Search state
  searchQuery: string;
  searchResults: SearchResult[];
  searchLoading: boolean;
  
  // UI state
  sidebarWidth: number;
  showFileTree: boolean;

  // ─── File Tree Actions ───────────────────────────────────────
  
  /** Load file tree for a session */
  loadTree: (sessionId: string, parentPath?: string) => Promise<void>;
  
  /** Toggle directory expansion */
  toggleExpand: (path: string) => void;
  
  /** Expand a specific path */
  expandPath: (path: string) => void;
  
  /** Collapse a specific path */
  collapsePath: (path: string) => void;
  
  /** Collapse all directories */
  collapseAll: () => void;
  
  /** Refresh file tree */
  refreshTree: (sessionId: string) => Promise<void>;
  
  /** Clear file tree */
  clearTree: () => void;

  // ─── File Content Actions ────────────────────────────────────
  
  /** Load file content for viewing */
  loadFile: (sessionId: string, path: string) => Promise<void>;
  
  /** Clear current file */
  clearFile: () => void;

  // ─── Search Actions ──────────────────────────────────────────
  
  /** Search for files by pattern */
  searchFiles: (sessionId: string, pattern: string) => Promise<void>;
  
  /** Clear search results */
  clearSearch: () => void;
  
  /** Set search query */
  setSearchQuery: (query: string) => void;

  // ─── UI Actions ──────────────────────────────────────────────
  
  /** Set sidebar width */
  setSidebarWidth: (width: number) => void;
  
  /** Toggle file tree visibility */
  toggleFileTree: () => void;
  
  /** Set file tree visibility */
  setShowFileTree: (show: boolean) => void;
}

// ─── API Helpers ────────────────────────────────────────────────

const API_BASE = "/api/files";

async function fetchTree(sessionId: string, path?: string): Promise<FileTreeItem[]> {
  const url = new URL(API_BASE + "/tree", window.location.origin);
  url.searchParams.set("sessionId", sessionId);
  if (path && path !== ".") {
    url.searchParams.set("path", path);
  }
  
  const res = await fetch(url.toString());
  const data = await res.json();
  
  if (!data.ok) {
    throw new Error(data.error || "Failed to load file tree");
  }
  
  return data.data;
}

async function fetchFileContent(sessionId: string, path: string): Promise<FileContent> {
  const url = new URL(API_BASE + "/content", window.location.origin);
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("path", path);
  
  const res = await fetch(url.toString());
  const data = await res.json();
  
  if (!data.ok) {
    throw new Error(data.error || "Failed to load file");
  }
  
  return data.data;
}

async function searchFilesApi(sessionId: string, pattern: string): Promise<SearchResult[]> {
  const url = new URL(API_BASE + "/search", window.location.origin);
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("pattern", pattern);
  
  const res = await fetch(url.toString());
  const data = await res.json();
  
  if (!data.ok) {
    throw new Error(data.error || "Failed to search files");
  }
  
  return data.data;
}

// ─── Store Implementation ───────────────────────────────────────

export const useFileStore = create<FileState>((set, get) => ({
  // Initial state
  tree: [],
  treeLoading: false,
  treeError: null,
  expandedPaths: new Set(),
  currentFile: null,
  fileLoading: false,
  fileError: null,
  searchQuery: "",
  searchResults: [],
  searchLoading: false,
  sidebarWidth: 250,
  showFileTree: true,

  // ─── File Tree Actions ───────────────────────────────────────

  loadTree: async (sessionId, parentPath = ".") => {
    // If loading root, set loading state
    if (parentPath === ".") {
      set({ treeLoading: true, treeError: null });
    }
    
    try {
      const items = await fetchTree(sessionId, parentPath);
      
      if (parentPath === ".") {
        // Replace entire tree
        set({ tree: items, treeLoading: false });
      } else {
        // Update children of expanded directory
        const updateChildren = (items: FileTreeItem[]): FileTreeItem[] => {
          return items.map(item => {
            if (item.path === parentPath) {
              return { ...item, children: items, loading: false };
            }
            if (item.children) {
              return { ...item, children: updateChildren(item.children) };
            }
            return item;
          });
        };
        
        set(state => ({
          tree: updateChildren(state.tree),
          treeLoading: false,
        }));
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      set({ treeError: error, treeLoading: false });
    }
  },

  toggleExpand: (path) => {
    set(state => {
      const newExpanded = new Set(state.expandedPaths);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return { expandedPaths: newExpanded };
    });
  },

  expandPath: (path) => {
    set(state => {
      const newExpanded = new Set(state.expandedPaths);
      newExpanded.add(path);
      return { expandedPaths: newExpanded };
    });
  },

  collapsePath: (path) => {
    set(state => {
      const newExpanded = new Set(state.expandedPaths);
      newExpanded.delete(path);
      return { expandedPaths: newExpanded };
    });
  },

  collapseAll: () => {
    set({ expandedPaths: new Set() });
  },

  refreshTree: async (sessionId) => {
    set({ expandedPaths: new Set() });
    await get().loadTree(sessionId, ".");
  },

  clearTree: () => {
    set({
      tree: [],
      treeLoading: false,
      treeError: null,
      expandedPaths: new Set(),
    });
  },

  // ─── File Content Actions ────────────────────────────────────

  loadFile: async (sessionId, path) => {
    set({ fileLoading: true, fileError: null });
    
    try {
      const fileContent = await fetchFileContent(sessionId, path);
      set({ currentFile: fileContent, fileLoading: false });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      set({ fileError: error, fileLoading: false });
    }
  },

  clearFile: () => {
    set({ currentFile: null, fileError: null });
  },

  // ─── Search Actions ──────────────────────────────────────────

  searchFiles: async (sessionId, pattern) => {
    if (!pattern.trim()) {
      set({ searchResults: [], searchLoading: false });
      return;
    }
    
    set({ searchLoading: true });
    
    try {
      const results = await searchFilesApi(sessionId, pattern);
      set({ searchResults: results, searchLoading: false });
    } catch (e) {
      console.error("Search failed:", e);
      set({ searchResults: [], searchLoading: false });
    }
  },

  clearSearch: () => {
    set({ searchResults: [], searchQuery: "" });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  // ─── UI Actions ──────────────────────────────────────────────

  setSidebarWidth: (width) => {
    set({ sidebarWidth: Math.max(150, Math.min(500, width)) });
  },

  toggleFileTree: () => {
    set(state => ({ showFileTree: !state.showFileTree }));
  },

  setShowFileTree: (show) => {
    set({ showFileTree: show });
  },
}));
