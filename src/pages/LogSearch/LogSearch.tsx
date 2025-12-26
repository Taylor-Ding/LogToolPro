import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from '@tauri-apps/plugin-dialog';
import {
    History, Play, SlidersHorizontal, Fingerprint, FolderOpen,
    X, Plus, Check, AlertCircle, Eye, Download, RefreshCw, Wifi,
    FileText, Server, Search, ChevronUp, ChevronDown, WrapText, ArrowDownToLine, Copy, Loader2, Trash2, Clock, Maximize2, Minimize2, GitGraph, CheckCircle2, XCircle, RotateCcw
} from "lucide-react";
import { API_ENDPOINTS, TraceSystemResponse, TopologyResponse, TopologyNode, NodeDetailResponse } from "../../config/apiConfig";
import "./LogSearch.css";

// Server Info interface matching the backend
interface ServerInfo {
    id: string;
    host: string;
    port: number;
    username: string;
    password: string;
    description: string;
    environment: string;
    status: string;
}

// Log file info from backend
interface LogFileInfo {
    path: string;
    name: string;
    match_count: number;
}

// Search result from backend
interface LogSearchResult {
    server_id: string;
    host: string;
    files: LogFileInfo[];
    total_matches: number;
    duration_ms: number;
    error: string | null;
}

// Extended result for UI state
interface SearchResultState {
    id: string;
    serverId: string;
    serverInfo: ServerInfo;
    name: string;
    ip: string;
    path: string;
    status: "completed" | "loading" | "error";
    files: LogFileInfo[];
    fileCount: number;
    matchCount: number;
    duration: string;
    error?: { title: string; message: string };
}

interface ModalData {
    name: string;
    ip: string;
    path: string;
    serverInfo: ServerInfo;
    files: LogFileInfo[];
    traceId: string;
}

// Export Status Interface
interface ExportStatus {
    isOpen: boolean;
    isExporting: boolean;
    current: number;
    total: number;
    currentFile: string;
    logs: string[];
}

// Search History Item
interface SearchHistoryItem {
    id: string;
    traceId: string;
    logPath: string;
    serverIds: string[];
    serverNames: string[];
    timestamp: number;
    totalMatchCount: number;
}

const HISTORY_STORAGE_KEY = 'log_search_history';
const MAX_HISTORY_ITEMS = 20;

export function LogSearch() {
    // Selected servers for search
    const [selectedServers, setSelectedServers] = useState<ServerInfo[]>([]);
    // All available servers from backend
    const [availableServers, setAvailableServers] = useState<ServerInfo[]>([]);
    // Server selection modal visibility
    // Server selection modal visibility and source
    const [showServerModal, setShowServerModal] = useState(false);
    const [serverSelectionSource, setServerSelectionSource] = useState<'log-search' | 'server-chain'>('log-search');
    // Search running state
    const [isSearching, setIsSearching] = useState(false);

    // Tab state
    const [activeTab, setActiveTab] = useState<'log-search' | 'transaction-chain' | 'server-chain'>('log-search');

    // Transaction Chain State
    const [showMap, setShowMap] = useState(false);
    const [mockNodes, setMockNodes] = useState<any[]>([]);
    const [systemCode, setSystemCode] = useState<string | null>(null);
    const [tradeCode, setTradeCode] = useState<string | null>(null);
    const [environmentInfo, setEnvironmentInfo] = useState<string | null>(null);
    const [isLoadingTrace, setIsLoadingTrace] = useState(false);
    const [traceError, setTraceError] = useState<string | null>(null);

    // Node Detail Modal State
    const [nodeDetailModalOpen, setNodeDetailModalOpen] = useState(false);
    const [nodeDetailData, setNodeDetailData] = useState<NodeDetailResponse | null>(null);
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [isLoadingNodeDetail, setIsLoadingNodeDetail] = useState(false);

    // Server Chain State
    interface ServerChainNode {
        filename: string;
        dus_id: string;
        ip: string;
        log_path: string;
        children: ServerChainNode[];
    }
    const [serverChainTraceId, setServerChainTraceId] = useState('');
    const [serverChainLogPath, setServerChainLogPath] = useState('/app/appuser/logs');
    const [serverChainSelectedServers, setServerChainSelectedServers] = useState<ServerInfo[]>([]);
    const [serverChainNodes, setServerChainNodes] = useState<ServerChainNode[]>([]);
    const [serverChainLogs, setServerChainLogs] = useState<string[]>([]);
    const [isServerChainLoading, setIsServerChainLoading] = useState(false);
    const [serverChainError, setServerChainError] = useState<string | null>(null);
    const [serverChainTotalHops, setServerChainTotalHops] = useState(0);
    const [serverChainDuration, setServerChainDuration] = useState(0);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalData, setModalData] = useState<ModalData | null>(null);

    // Form state
    const [traceId, setTraceId] = useState("");
    const [logPath, setLogPath] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResultState[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    // Export state
    const [exportStatus, setExportStatus] = useState<ExportStatus>({
        isOpen: false,
        isExporting: false,
        current: 0,
        total: 0,
        currentFile: '',
        logs: []
    });

    // Search history state
    const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
    const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
    const historyDropdownRef = useRef<HTMLDivElement>(null);

    // Load servers from backend on mount
    useEffect(() => {
        loadServers();
        loadSearchHistory();
    }, []);

    // Close history dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (historyDropdownRef.current && !historyDropdownRef.current.contains(event.target as Node)) {
                setShowHistoryDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadServers = async () => {
        try {
            const servers = await invoke<ServerInfo[]>("list_servers");
            setAvailableServers(servers);
        } catch (error) {
            console.error("Failed to load servers:", error);
        }
    };

    const removeServer = (id: string, source: 'log-search' | 'server-chain' = 'log-search') => {
        if (source === 'log-search') {
            setSelectedServers(prev => prev.filter(s => s.id !== id));
        } else {
            setServerChainSelectedServers(prev => prev.filter(s => s.id !== id));
        }
    };

    const openServerModal = (source: 'log-search' | 'server-chain') => {
        setServerSelectionSource(source);
        setShowServerModal(true);
    };

    const openDetailModal = (result: SearchResultState) => {
        setModalData({
            name: result.name,
            ip: result.ip,
            path: logPath,
            serverInfo: result.serverInfo,
            files: result.files,
            traceId: traceId
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setModalData(null);
    };

    const resetCriteria = () => {
        setTraceId("");
        setLogPath("");
        setSelectedServers([]);
        setSearchResults([]);
        setHasSearched(false);
    };

    // Get cache policy retention duration in milliseconds
    const getCacheRetentionMs = (policy: string): number => {
        switch (policy) {
            case '24h': return 24 * 60 * 60 * 1000;
            case '3days': return 3 * 24 * 60 * 60 * 1000;
            case '1week': return 7 * 24 * 60 * 60 * 1000;
            case 'none': return 0; // No retention, clear all
            default: return 3 * 24 * 60 * 60 * 1000; // Default to 3 days
        }
    };

    // Load search history from localStorage with cache policy applied
    const loadSearchHistory = () => {
        try {
            const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
            if (!stored) return;

            let history: SearchHistoryItem[] = JSON.parse(stored);

            // Get cache policy from settings
            const settingsStr = localStorage.getItem('app_settings');
            if (settingsStr) {
                const settings = JSON.parse(settingsStr);
                const cachePolicy = settings.cachePolicy || '3days';
                const retentionMs = getCacheRetentionMs(cachePolicy);

                if (retentionMs === 0) {
                    // "none" policy - clear all history
                    history = [];
                } else {
                    // Filter out expired items
                    const now = Date.now();
                    history = history.filter(item => (now - item.timestamp) < retentionMs);
                }

                // Update storage if items were removed
                if (history.length !== JSON.parse(stored).length) {
                    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
                }
            }

            setSearchHistory(history);
        } catch (error) {
            console.error('Failed to load search history:', error);
        }
    };

    // Save search to history
    const saveToHistory = (searchTraceId: string, searchLogPath: string, servers: ServerInfo[], matchCount: number) => {
        const newItem: SearchHistoryItem = {
            id: crypto.randomUUID(),
            traceId: searchTraceId,
            logPath: searchLogPath,
            serverIds: servers.map(s => s.id),
            serverNames: servers.map(s => s.description || s.host),
            timestamp: Date.now(),
            totalMatchCount: matchCount
        };

        setSearchHistory(prev => {
            // Remove duplicates with same traceId + logPath
            const filtered = prev.filter(h => !(h.traceId === searchTraceId && h.logPath === searchLogPath));
            const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });
    };

    // Load history item into search form
    const loadHistoryItem = (item: SearchHistoryItem) => {
        setTraceId(item.traceId);
        setLogPath(item.logPath);
        // Restore servers if they still exist
        const matchedServers = availableServers.filter(s => item.serverIds.includes(s.id));
        setSelectedServers(matchedServers);
        setShowHistoryDropdown(false);
    };

    // Clear all search history
    const clearSearchHistory = () => {
        if (confirm('确定要清空所有搜索历史吗？')) {
            setSearchHistory([]);
            localStorage.removeItem(HISTORY_STORAGE_KEY);
            setShowHistoryDropdown(false);
        }
    };

    const handleServerSelect = (servers: ServerInfo[]) => {
        if (serverSelectionSource === 'log-search') {
            setSelectedServers(servers);
        } else {
            setServerChainSelectedServers(servers);
        }
        setShowServerModal(false);
    };

    // Execute search on all selected servers concurrently
    const handleExecuteSearch = async () => {
        console.log("handleExecuteSearch called", { traceId, logPath, selectedServers: selectedServers.length });
        setValidationError(null);

        // Validate all required fields
        if (!traceId.trim()) {
            setValidationError("请输入流水号 (globalBusiTrackNo)");
            return;
        }
        if (!logPath.trim()) {
            setValidationError("请输入日志文件路径");
            return;
        }
        if (selectedServers.length === 0) {
            setValidationError("请选择至少一台目标服务器");
            return;
        }

        setIsSearching(true);
        setHasSearched(true);

        // Initialize results with loading state
        const initialResults: SearchResultState[] = selectedServers.map((server, idx) => ({
            id: `${server.id}-${idx}`,
            serverId: server.id,
            serverInfo: server,
            name: server.description || `服务器 ${idx + 1}`,
            ip: server.host,
            path: logPath,
            status: "loading" as const,
            files: [],
            fileCount: 0,
            matchCount: 0,
            duration: "",
        }));
        setSearchResults(initialResults);

        // Execute searches concurrently
        const searchPromises = selectedServers.map(async (server) => {
            try {
                const result = await invoke<LogSearchResult>("search_log_files", {
                    host: server.host,
                    port: server.port,
                    username: server.username,
                    password: server.password,
                    serverId: server.id,
                    logPath: logPath,
                    traceId: traceId,
                });

                // Update the specific result
                setSearchResults(prev => prev.map(r => {
                    if (r.serverId === server.id) {
                        if (result.error) {
                            return {
                                ...r,
                                status: "error" as const,
                                duration: `${(result.duration_ms / 1000).toFixed(1)}s`,
                                error: { title: "搜索失败", message: result.error }
                            };
                        }
                        return {
                            ...r,
                            status: "completed" as const,
                            files: result.files,
                            fileCount: result.files.length,
                            matchCount: result.total_matches,
                            duration: `${(result.duration_ms / 1000).toFixed(1)}s`,
                        };
                    }
                    return r;
                }));
            } catch (error) {
                // Update with error state
                setSearchResults(prev => prev.map(r => {
                    if (r.serverId === server.id) {
                        return {
                            ...r,
                            status: "error" as const,
                            error: { title: "连接错误", message: String(error) }
                        };
                    }
                    return r;
                }));
            }
        });

        await Promise.all(searchPromises);
        setIsSearching(false);

        // Calculate total match count and save to history after search completes
        setSearchResults(currentResults => {
            const totalMatches = currentResults.reduce((sum, r) => sum + (r.matchCount || 0), 0);
            saveToHistory(traceId, logPath, selectedServers, totalMatches);
            return currentResults;
        });
    };

    // Generic Export Function
    const handleExport = async (filesToExport: { serverInfo: ServerInfo; file: LogFileInfo; serverName: string }[]) => {
        if (filesToExport.length === 0) {
            alert("没有可导出的日志文件");
            return;
        }

        try {
            // 1. Open directory selection dialog
            const selectedDir = await open({
                directory: true,
                multiple: false,
                title: '选择导出目录'
            });

            if (!selectedDir) return;

            // 2. Initialize progress
            setExportStatus({
                isOpen: true,
                isExporting: true,
                current: 0,
                total: filesToExport.length,
                currentFile: '准备导出...',
                logs: [`开始导出 ${filesToExport.length} 个文件到 ${selectedDir}...`]
            });

            // 3. Iterate and export
            for (let i = 0; i < filesToExport.length; i++) {
                const item = filesToExport[i];
                const filename = `${item.serverName}_${item.file.name}`;

                setExportStatus(prev => ({
                    ...prev,
                    current: i + 1,
                    currentFile: filename,
                    logs: [...prev.logs, `正在下载: ${filename}...`]
                }));

                try {
                    // Read file content (using a larger limit for export)
                    const content = await invoke<string>("read_log_file", {
                        host: item.serverInfo.host,
                        port: item.serverInfo.port,
                        username: item.serverInfo.username,
                        password: item.serverInfo.password,
                        filePath: item.file.path,
                        traceId: traceId,
                        maxLines: 50000,
                    });

                    // Write to local disk using backend command
                    // NOTE: Depending on OS, path separators might need handling, but we assume backend handles 'path' correctly or we construct it.
                    // For simplicity, we assume we just append filename to directory. 
                    const sep = navigator.userAgent.includes("Win") ? "\\" : "/";
                    const fullPath = `${selectedDir}${sep}${filename}`;

                    await invoke("write_file", {
                        path: fullPath,
                        content: content
                    });

                    setExportStatus(prev => ({
                        ...prev,
                        logs: [...prev.logs, `✓ 成功: ${filename}`]
                    }));
                } catch (error) {
                    console.error(`Export failed for ${filename}:`, error);
                    setExportStatus(prev => ({
                        ...prev,
                        logs: [...prev.logs, `✗ 失败: ${filename} - ${error}`]
                    }));
                }
            }

            // 4. Complete
            setExportStatus(prev => ({
                ...prev,
                isExporting: false,
                currentFile: '导出完成',
                logs: [...prev.logs, '所有任务已完成']
            }));

        } catch (error) {
            console.error("Export process failed:", error);
            alert("导出流程发生错误");
            setExportStatus(prev => ({ ...prev, isOpen: false }));
        }
    };

    // Export single server results
    const handleDownloadResult = (result: SearchResultState) => {
        const files = result.files.map(file => ({
            serverInfo: result.serverInfo,
            file: file,
            serverName: result.name
        }));
        handleExport(files);
    };

    // Export ALL results
    const handleGlobalExport = () => {
        const completedResults = searchResults.filter(r => r.status === 'completed');
        const allFiles = completedResults.flatMap(result =>
            result.files.map(file => ({
                serverInfo: result.serverInfo,
                file: file,
                serverName: result.name
            }))
        );
        handleExport(allFiles);
    };

    // Close export modal
    const closeExportModal = () => {
        if (exportStatus.isExporting) return; // Prevent closing while running
        setExportStatus(prev => ({ ...prev, isOpen: false }));
    };

    // Get display name for server (description or IP)
    const getServerDisplayName = (server: ServerInfo) => {
        if (server.description) {
            return `${server.description} (${server.host})`;
        }
        return server.host;
    };

    // Helper function to extract host from tags
    const getHostFromTags = (tags: { key: string; value: string }[]): string => {
        const hostTag = tags.find(tag => tag.key === 'host');
        return hostTag ? hostTag.value : 'Unknown';
    };

    // Helper function to extract environment from serviceCode
    const extractEnvironment = (serviceCode: string): string => {
        const parts = serviceCode.split('_');
        return parts.length > 0 ? parts[0] : '';
    };

    // Helper function to format timestamp
    const formatTimestamp = (timestamp: number): string => {
        const date = new Date(timestamp);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const ms = String(date.getMilliseconds()).padStart(3, '0');
        return `${hours}:${minutes}:${seconds}.${ms}`;
    };

    // Helper function to calculate duration
    const calculateDuration = (startTime: number, endTime: number): string => {
        const duration = endTime - startTime;
        if (duration >= 1000) {
            return `${(duration / 1000).toFixed(2)}s`;
        }
        return `${duration}ms`;
    };

    // Helper function to build tree structure from flat topology data
    const buildTreeStructure = (nodes: TopologyNode[]) => {
        // Create a map for quick lookup
        const nodeMap = new Map<string, any>();

        // Initialize all nodes
        nodes.forEach(node => {
            nodeMap.set(node.nodeId, {
                id: node.nodeId,
                service: node.serviceCode.split('_').slice(2).join('_') || node.serviceCode,
                serviceCode: node.serviceCode,  // Keep original serviceCode for API call
                ip: getHostFromTags(node.tags),
                time: formatTimestamp(node.startTime),
                duration: calculateDuration(node.startTime, node.endTime),
                status: node.errorStatement ? 'error' : 'success',
                logs: [
                    `[INFO] ${node.endpointName}`,
                    `[INFO] Duration: ${calculateDuration(node.startTime, node.endTime)}`
                ],
                next: [],
                nodeId: node.nodeId,
                parentNodeId: node.parentNodeId
            });
        });

        // Build relationships
        const rootNodes: any[] = [];
        nodeMap.forEach(node => {
            if (node.parentNodeId === '0') {
                rootNodes.push(node);
            } else {
                const parent = nodeMap.get(node.parentNodeId);
                if (parent) {
                    parent.next.push(node);
                }
            }
        });

        return rootNodes;
    };

    const handleGenerateMap = async () => {
        // Reset previous state
        setTraceError(null);
        setSystemCode(null);
        setTradeCode(null);
        setEnvironmentInfo(null);
        setShowMap(false);

        // Validate traceId
        if (!traceId.trim()) {
            setTraceError('请输入流水号');
            return;
        }

        setIsLoadingTrace(true);

        try {
            // Step 1: Call the trace system API
            const systemResponse = await fetch(API_ENDPOINTS.traceSystem(traceId), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!systemResponse.ok) {
                throw new Error(`HTTP error! status: ${systemResponse.status}`);
            }

            const systemData: TraceSystemResponse = await systemResponse.json();

            // Check if the first API call was successful
            if (!systemData.success || systemData.code !== 0) {
                setTraceError(systemData.message || '获取系统信息失败');
                return;
            }

            // Extract systemCode and tradeCode
            setSystemCode(systemData.data.systemCode);
            setTradeCode(systemData.data.tradeCode);

            // Step 2: Call the topology API with systemCode
            const topologyResponse = await fetch(API_ENDPOINTS.traceTopology(traceId, 'global'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!topologyResponse.ok) {
                throw new Error(`HTTP error! status: ${topologyResponse.status}`);
            }

            const topologyData: TopologyResponse = await topologyResponse.json();

            // Check if the second API call was successful
            if (!topologyData.success || !topologyData.data || topologyData.data.length === 0) {
                setTraceError(topologyData.message || '获取拓扑信息失败');
                return;
            }

            // Extract environment from first node's serviceCode
            if (topologyData.data.length > 0) {
                const env = extractEnvironment(topologyData.data[0].serviceCode);
                setEnvironmentInfo(env);
            }

            // Build tree structure from topology data
            const treeNodes = buildTreeStructure(topologyData.data);
            setMockNodes(treeNodes);
            setShowMap(true);

        } catch (error) {
            console.error('Failed to fetch trace data:', error);
            setTraceError(`API调用失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsLoadingTrace(false);
        }
    };

    // Reset trace state
    const handleResetTrace = () => {
        setTraceId("");
        setMockNodes([]);
        setShowMap(false);
        setTraceError(null);
        setSystemCode(null);
        setTradeCode(null);
        setEnvironmentInfo(null);
    };

    // Handle node click to fetch and show node details
    const handleNodeClick = async (node: any) => {
        if (!traceId || !tradeCode) return;

        setSelectedNode(node);
        setNodeDetailModalOpen(true);
        setIsLoadingNodeDetail(true);
        setNodeDetailData(null);

        try {
            const response = await fetch(
                API_ENDPOINTS.traceNodeApp(node.serviceCode, traceId, tradeCode, node.nodeId),
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: NodeDetailResponse = await response.json();
            setNodeDetailData(data);
        } catch (error) {
            console.error('Failed to fetch node detail:', error);
        } finally {
            setIsLoadingNodeDetail(false);
        }
    };

    // Handle server chain trace
    const handleServerChainTrace = async () => {
        if (!serverChainTraceId.trim()) {
            setServerChainError('请输入流水号');
            return;
        }
        if (serverChainSelectedServers.length === 0) {
            setServerChainError('请选择至少一台目标服务器');
            return;
        }



        setIsServerChainLoading(true);
        setServerChainError(null);
        setServerChainNodes([]);
        setServerChainLogs([]);

        let anySuccess = false;

        // Execute trace on all selected servers
        for (const server of serverChainSelectedServers) {
            setServerChainLogs(prev => [...prev, `[INFO] 在 ${server.host} 上开始搜索...`]);

            try {
                const result = await invoke<{
                    nodes: ServerChainNode[];
                    trace_log: string[];
                    total_hops: number;
                    duration_ms: number;
                    error: string | null;
                }>('trace_server_chain', {
                    host: server.host,
                    port: server.port,
                    username: server.username,
                    password: server.password,
                    traceId: serverChainTraceId,
                    logPath: serverChainLogPath,
                    knownServers: availableServers
                });

                if (result.error) {
                    setServerChainLogs(prev => [...prev, `[WARN] ${server.host}: ${result.error}`]);
                } else if (result.nodes.length > 0) {
                    setServerChainNodes(result.nodes);
                    setServerChainLogs(prev => [...prev, `[SUCCESS] 在 ${server.host} 找到链路!`, ...result.trace_log]);
                    setServerChainTotalHops(result.total_hops);
                    setServerChainDuration(result.duration_ms);
                    anySuccess = true;
                    break;
                } else {
                    setServerChainLogs(prev => [...prev, `[INFO] ${server.host} 未找到相关链路`, ...result.trace_log]);
                }
            } catch (error) {
                console.error('Server chain trace failed:', error);
                setServerChainLogs(prev => [...prev, `[ERROR] 连接 ${server.host} 失败: ${error instanceof Error ? error.message : '未知错误'}`]);
            }
        }

        if (!anySuccess) {
            setServerChainError('在所有选中的服务器上均未找到完整的交易链路');
        }

        setIsServerChainLoading(false);
    };

    // Render server chain node recursively
    const renderServerChainNode = (node: ServerChainNode, depth: number = 0) => {
        const isValid = node.dus_id.startsWith('B') || node.dus_id.startsWith('C');

        return (
            <div key={`${node.ip}-${node.dus_id}-${depth}`} style={{ marginLeft: depth * 24 }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    marginBottom: '8px',
                    background: 'var(--color-surface-dark)',
                    border: `1px solid ${isValid ? 'var(--color-success)' : 'var(--color-text-muted)'}`,
                    borderRadius: '8px',
                    fontSize: '13px'
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: isValid ? 'var(--color-success)' : 'var(--color-text-muted)'
                    }} />
                    <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{node.filename}</span>
                        <span style={{
                            padding: '2px 8px',
                            background: isValid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                            borderRadius: '4px',
                            color: isValid ? 'var(--color-success)' : 'var(--color-text-muted)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px'
                        }}>
                            {node.dus_id}
                        </span>
                        <span style={{
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--color-text-muted)',
                            fontSize: '12px'
                        }}>
                            {node.ip}
                        </span>
                    </div>
                </div>
                {node.children.length > 0 && (
                    <div style={{ borderLeft: '2px solid var(--color-border)', marginLeft: '4px', paddingLeft: '8px' }}>
                        {node.children.map((child) => renderServerChainNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    // Recursive component to render the chain tree
    const renderChainNode = (node: any, isRoot: boolean = true, index: number = 0, total: number = 1) => {
        let connectionType = 'single';
        if (total > 1) {
            if (index === 0) connectionType = 'top';
            else if (index === total - 1) connectionType = 'bottom';
            else connectionType = 'middle';
        }

        return (
            <div key={node.id} className="chain-node-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
                {/* Connection Line for non-root nodes */}
                {!isRoot && (
                    <div className={`chain-connector ${connectionType}`}>
                        <div className="connector-line"></div>
                        <div className="connector-arrow">
                            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>
                )}

                <div className="node-content-group" style={{ display: 'flex', alignItems: 'center' }}>
                    {/* Node Card */}
                    <div
                        className={`chain-node ${node.status}`}
                        style={{
                            background: 'var(--color-surface-dark)',
                            border: `1px solid ${node.status === 'success' ? 'var(--color-success)' : 'var(--color-error)'}`,
                            borderRadius: '6px',
                            padding: '12px',
                            minWidth: '180px',
                            position: 'relative',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            zIndex: 2,
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                        }}
                        onClick={() => handleNodeClick(node)}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontWeight: 600, fontSize: '13px' }}>{node.service}</span>
                            {node.status === 'success' ?
                                <CheckCircle2 size={14} color="var(--color-success)" /> :
                                <XCircle size={14} color="var(--color-error)" />
                            }
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                            <div>IP: {node.ip}</div>
                            <div>Time: {node.time}</div>
                            <div>Duration: {node.duration}</div>
                        </div>
                        <div className="node-logs" style={{
                            background: 'rgba(0,0,0,0.2)',
                            padding: '6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono)',
                            color: '#94a3b8',
                            lineHeight: '1.4'
                        }}>
                            {node.logs.map((log: string, i: number) => (
                                <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                                    {log}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Render Children */}
                {node.next && node.next.length > 0 && (
                    <div className="chain-children" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '0', position: 'relative' }}>
                        {/* Vertical Spine for branching */}
                        {node.next.length > 1 && <div className="branch-spine"></div>}

                        {node.next.map((child: any, idx: number) => renderChainNode(child, false, idx, node.next.length))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="log-search-page">
            {/* Header */}
            <header className="page-header">
                <div className="page-title">
                    <h2>日志搜索</h2>
                    <p>并发检索多台服务器日志，快速定位分布式系统问题</p>
                </div>
                <div className="header-actions">
                    <div className="history-dropdown-container" ref={historyDropdownRef}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                        >
                            <History size={18} />
                            <span>搜索历史</span>
                            {searchHistory.length > 0 && (
                                <span className="history-badge">{searchHistory.length}</span>
                            )}
                        </button>
                        {showHistoryDropdown && (
                            <div className="history-dropdown">
                                <div className="history-dropdown-header">
                                    <span>最近搜索</span>
                                    {searchHistory.length > 0 && (
                                        <button className="clear-history-btn" onClick={clearSearchHistory}>
                                            <Trash2 size={14} />
                                            清空
                                        </button>
                                    )}
                                </div>
                                <div className="history-dropdown-body">
                                    {searchHistory.length === 0 ? (
                                        <div className="history-empty">
                                            <Clock size={32} strokeWidth={1} />
                                            <p>暂无搜索历史</p>
                                        </div>
                                    ) : (
                                        searchHistory.map(item => (
                                            <div
                                                key={item.id}
                                                className="history-item"
                                                onClick={() => loadHistoryItem(item)}
                                            >
                                                <div className="history-item-main">
                                                    <span className="history-trace-id" title={item.traceId}>
                                                        {item.traceId.length > 30 ? item.traceId.slice(0, 30) + '...' : item.traceId}
                                                    </span>
                                                    <span className="history-path" title={item.logPath}>
                                                        {item.logPath}
                                                    </span>
                                                </div>
                                                <div className="history-item-meta">
                                                    <span className="history-servers">
                                                        {item.serverNames.slice(0, 2).join(', ')}{item.serverNames.length > 2 ? ` +${item.serverNames.length - 2}` : ''}
                                                    </span>
                                                    <span className="history-time">
                                                        {new Date(item.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <button className="btn btn-primary" onClick={handleExecuteSearch} disabled={isSearching}>
                        {isSearching ? <Loader2 size={18} className="spin" /> : <Play size={18} />}
                        <span>{isSearching ? '搜索中...' : '执行搜索'}</span>
                    </button>
                </div>
            </header>

            {/* Tab Navigation */}
            <div className="tabs-bar">
                <button
                    className={`tab-item ${activeTab === 'log-search' ? 'active' : ''}`}
                    onClick={() => setActiveTab('log-search')}
                >
                    <Search size={16} />
                    <span>日志搜索</span>
                </button>
                <button
                    className={`tab-item ${activeTab === 'transaction-chain' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transaction-chain')}
                >
                    <GitGraph size={16} />
                    <span>交易链路-综管</span>
                </button>
                <button
                    className={`tab-item ${activeTab === 'server-chain' ? 'active' : ''}`}
                    onClick={() => setActiveTab('server-chain')}
                >
                    <Server size={16} />
                    <span>交易链路-服务器</span>
                </button>
            </div>

            {/* Body */}
            <div className="content-body">
                <div className="container-inner">

                    {activeTab === 'log-search' && (
                        <>
                            {/* Search Criteria Card */}
                            <div className="criteria-card">
                                <div className="criteria-header">
                                    <h3>
                                        <SlidersHorizontal size={18} />
                                        搜索条件
                                    </h3>
                                    {validationError && (
                                        <div className="validation-error-badge">
                                            <AlertCircle size={14} />
                                            <span>{validationError}</span>
                                        </div>
                                    )}
                                    <button className="reset-btn" onClick={resetCriteria}>重置条件</button>
                                </div>
                                <div className="criteria-body">
                                    {/* globalBusiTrackNo */}
                                    <div className="form-field col-6">
                                        <label>流水号 (globalBusiTrackNo)或检索信息</label>
                                        <div className="input-with-icon">
                                            <Fingerprint size={18} className="input-icon" />
                                            <input type="text" placeholder="e.g. 202512240922291022199CK02403313" value={traceId} onChange={(e) => setTraceId(e.target.value)} />
                                        </div>
                                    </div>

                                    {/* Log Path */}
                                    <div className="form-field col-6">
                                        <label>日志文件路径</label>
                                        <div className="input-with-icon">
                                            <FolderOpen size={18} className="input-icon" />
                                            <input
                                                type="text"
                                                className="font-mono"
                                                placeholder="/app/appuser/logs/..."
                                                value={logPath}
                                                onChange={(e) => setLogPath(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Target Servers */}
                                    <div className="form-field col-12">
                                        <label>目标服务器</label>
                                        <div className="server-tags-container">
                                            {selectedServers.map(server => (
                                                <span key={server.id} className="server-tag">
                                                    <span className="server-tag-env">{server.environment || 'N/A'}</span>
                                                    {getServerDisplayName(server)}
                                                    <button onClick={() => removeServer(server.id, 'log-search')}>
                                                        <X size={14} />
                                                    </button>
                                                </span>
                                            ))}
                                            <button className="add-server-btn" onClick={() => openServerModal('log-search')}>
                                                <Plus size={16} />
                                                选择
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Results Section */}
                            {hasSearched && (
                                <div className="results-section">
                                    <div className="results-header">
                                        <div className="results-title-group">
                                            <h3>搜索结果</h3>
                                            {searchResults.filter(r => r.status === 'completed').length > 0 && (
                                                <span className="status-badge completed">{searchResults.filter(r => r.status === 'completed').length} 完成</span>
                                            )}
                                            {searchResults.filter(r => r.status === 'loading').length > 0 && (
                                                <span className="status-badge loading">{searchResults.filter(r => r.status === 'loading').length} 进行中</span>
                                            )}
                                        </div>
                                        <div className="results-actions">
                                            <span className="match-count">总计匹配行数: <strong>{searchResults.reduce((sum, r) => sum + (r.matchCount || 0), 0).toLocaleString()}</strong></span>
                                            <button className="btn btn-secondary" onClick={handleGlobalExport} title="导出所有命中日志">
                                                <Download size={16} />
                                                <span>导出结果</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Results Grid */}
                                    <div className="results-grid" style={{ marginTop: '16px' }}>
                                        {searchResults.map(result => (
                                            <ResultCard
                                                key={result.id}
                                                result={result}
                                                onViewDetail={() => openDetailModal(result)}
                                                onDownload={() => handleDownloadResult(result)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'transaction-chain' && (
                        <div className="criteria-card">
                            <div className="criteria-header">
                                <h3>
                                    <GitGraph size={18} />
                                    交易链路分析
                                </h3>
                            </div>
                            <div className="criteria-body">
                                <div className="trace-input-row">
                                    <div className="form-field">
                                        <label>流水号 (globalBusiTrackNo)</label>
                                        <div className="input-with-icon">
                                            <Fingerprint size={18} className="input-icon" />
                                            <input
                                                type="text"
                                                placeholder="输入流水号以生成链路图..."
                                                value={traceId}
                                                onChange={(e) => setTraceId(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-field">
                                        <label style={{ visibility: 'hidden' }}>占位</label>
                                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                            <button
                                                className="btn btn-primary"
                                                onClick={handleGenerateMap}
                                                disabled={isLoadingTrace}
                                                style={{ flex: 1 }}
                                            >
                                                {isLoadingTrace ? <Loader2 size={18} className="spin" /> : <Play size={18} />}
                                                <span>{isLoadingTrace ? '加载中...' : '生成链路图'}</span>
                                            </button>
                                            <button
                                                className="btn btn-reset"
                                                onClick={handleResetTrace}
                                                title="重置"
                                            >
                                                <RotateCcw size={18} />
                                                <span>重置</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Error Display */}
                                {traceError && (
                                    <div className="validation-error-badge" style={{ marginTop: '12px' }}>
                                        <AlertCircle size={14} />
                                        <span>{traceError}</span>
                                    </div>
                                )}
                            </div>

                            {/* Transaction Map Visualization */}
                            {showMap ? (
                                <div className="transaction-map-container" style={{ marginTop: '24px', padding: '24px', borderTop: '1px solid var(--color-border)' }}>
                                    <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                            <GitGraph size={20} />
                                            交易链路可视化
                                        </h4>
                                        {systemCode && (
                                            <span style={{
                                                padding: '4px 12px',
                                                background: 'var(--color-surface-dark)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: '6px',
                                                fontSize: '13px',
                                                fontFamily: 'var(--font-mono)'
                                            }}>
                                                <strong>系统码:</strong> {systemCode}
                                            </span>
                                        )}
                                        {tradeCode && (
                                            <span style={{
                                                padding: '4px 12px',
                                                background: 'var(--color-surface-dark)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: '6px',
                                                fontSize: '13px',
                                                fontFamily: 'var(--font-mono)'
                                            }}>
                                                <strong>交易码:</strong> {tradeCode}
                                            </span>
                                        )}
                                        {environmentInfo && (
                                            <span style={{
                                                padding: '4px 12px',
                                                background: 'var(--color-surface-dark)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: '6px',
                                                fontSize: '13px',
                                                fontFamily: 'var(--font-mono)'
                                            }}>
                                                <strong>环境:</strong> {environmentInfo}
                                            </span>
                                        )}
                                    </div>
                                    <div className="chain-visual" style={{ overflowX: 'auto', paddingBottom: '16px' }}>
                                        {mockNodes.map((node) => renderChainNode(node))}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: '24px', borderTop: '1px solid var(--color-border)', marginTop: '24px' }}>
                                    <div style={{
                                        height: '300px',
                                        border: '2px dashed var(--color-border)',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'column',
                                        gap: '12px',
                                        color: 'var(--color-text-muted)',
                                        backgroundColor: 'var(--color-surface-hover)'
                                    }}>
                                        <GitGraph size={48} style={{ opacity: 0.3 }} />
                                        <p>输入流水号并点击生成以查看交易链路图</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Server Chain Tab Content */}
                    {activeTab === 'server-chain' && (
                        <div className="server-chain-container">
                            {/* Input Card */}
                            <div className="criteria-card">
                                <div className="criteria-header">
                                    <h3>
                                        <Server size={18} />
                                        服务器链路追踪
                                    </h3>
                                    {serverChainError && (
                                        <div className="validation-error-badge">
                                            <AlertCircle size={14} />
                                            <span>{serverChainError}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="criteria-body">
                                    <div className="form-field col-6">
                                        <label>流水号 (globalBusiTrackNo)</label>
                                        <div className="input-with-icon">
                                            <Fingerprint size={18} className="input-icon" />
                                            <input
                                                type="text"
                                                value={serverChainTraceId}
                                                onChange={(e) => setServerChainTraceId(e.target.value)}
                                                placeholder="输入交易流水号"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-field col-6">
                                        <label>日志路径</label>
                                        <div className="input-with-icon">
                                            <FolderOpen size={18} className="input-icon" />
                                            <input
                                                type="text"
                                                className="font-mono"
                                                value={serverChainLogPath}
                                                onChange={(e) => setServerChainLogPath(e.target.value)}
                                                placeholder="/app/appuser/logs"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-field col-12">
                                        <label>目标服务器 (支持多选)</label>
                                        <div className="server-tags-container">
                                            {serverChainSelectedServers.map(server => (
                                                <span key={server.id} className="server-tag">
                                                    <span className="server-tag-env">{server.environment || 'N/A'}</span>
                                                    {getServerDisplayName(server)}
                                                    <button onClick={() => removeServer(server.id, 'server-chain')}>
                                                        <X size={14} />
                                                    </button>
                                                </span>
                                            ))}
                                            <button className="add-server-btn" onClick={() => openServerModal('server-chain')}>
                                                <Plus size={16} />
                                                选择
                                            </button>
                                        </div>
                                    </div>
                                    <div className="form-actions col-12" style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'flex-end', gridColumn: '1 / -1' }}>
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleServerChainTrace}
                                            disabled={isServerChainLoading}
                                        >
                                            {isServerChainLoading ? (
                                                <>
                                                    <Loader2 size={16} className="spin" />
                                                    追踪中...
                                                </>
                                            ) : (
                                                <>
                                                    <Play size={16} />
                                                    开始追踪
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Results Section */}
                            {(serverChainLogs.length > 0 || serverChainNodes.length > 0) && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px', marginTop: '16px' }}>
                                    {/* Trace Log Panel */}
                                    <div className="criteria-card" style={{ maxHeight: '500px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                        <div className="criteria-header">
                                            <h3>
                                                <FileText size={18} />
                                                追踪日志
                                                {serverChainTotalHops > 0 && (
                                                    <span style={{
                                                        marginLeft: '8px',
                                                        fontSize: '12px',
                                                        padding: '2px 8px',
                                                        background: 'var(--color-primary)',
                                                        color: 'white',
                                                        borderRadius: '10px'
                                                    }}>
                                                        {serverChainTotalHops} 个节点 / {serverChainDuration}ms
                                                    </span>
                                                )}
                                            </h3>
                                        </div>
                                        <div style={{
                                            flex: 1,
                                            overflow: 'auto',
                                            padding: '12px',
                                            background: 'var(--color-surface-dark)',
                                            borderRadius: '8px',
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '12px',
                                            lineHeight: '1.6'
                                        }}>
                                            {serverChainLogs.map((log, idx) => (
                                                <div key={idx} style={{
                                                    color: log.startsWith('[ERROR]') ? 'var(--color-error)' :
                                                        log.startsWith('[WARN]') ? 'var(--color-warning)' :
                                                            log.startsWith('[SKIP]') ? 'var(--color-text-muted)' :
                                                                log.startsWith('  ->') ? 'var(--color-success)' :
                                                                    'var(--color-text)'
                                                }}>
                                                    {log || '\u00A0'}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Chain Visualization Panel */}
                                    <div className="criteria-card" style={{ maxHeight: '500px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                        <div className="criteria-header">
                                            <h3>
                                                <GitGraph size={18} />
                                                链路结构
                                            </h3>
                                        </div>
                                        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                                            {serverChainNodes.length > 0 ? (
                                                serverChainNodes.map(node => renderServerChainNode(node))
                                            ) : (
                                                <div style={{
                                                    textAlign: 'center',
                                                    padding: '40px',
                                                    color: 'var(--color-text-muted)'
                                                }}>
                                                    未找到链路节点
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {serverChainLogs.length === 0 && !isServerChainLoading && (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '60px 24px',
                                    gap: '12px',
                                    color: 'var(--color-text-muted)',
                                    backgroundColor: 'var(--color-surface-hover)',
                                    borderRadius: '12px',
                                    marginTop: '16px'
                                }}>
                                    <Server size={48} style={{ opacity: 0.3 }} />
                                    <p>输入流水号、日志路径和选择目标服务器，点击开始追踪</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Log Detail Modal */}
            {
                modalOpen && modalData && (
                    <LogDetailModal data={modalData} onClose={closeModal} />
                )
            }

            {/* Server Selection Modal */}
            {
                showServerModal && (
                    <ServerSelectModal
                        servers={availableServers}
                        selectedServers={serverSelectionSource === 'log-search' ? selectedServers : serverChainSelectedServers}
                        onConfirm={handleServerSelect}
                        onClose={() => setShowServerModal(false)}
                    />
                )
            }

            {/* Export Progress Modal */}
            {
                exportStatus.isOpen && (
                    <ExportProgressModal status={exportStatus} onClose={closeExportModal} />
                )
            }

            {/* Node Detail Modal */}
            {nodeDetailModalOpen && (
                <NodeDetailModal
                    node={selectedNode}
                    data={nodeDetailData}
                    isLoading={isLoadingNodeDetail}
                    onClose={() => setNodeDetailModalOpen(false)}
                />
            )}
        </div >
    );
}

// Server Selection Modal Component
interface ServerSelectModalProps {
    servers: ServerInfo[];
    selectedServers: ServerInfo[];
    onConfirm: (servers: ServerInfo[]) => void;
    onClose: () => void;
}

function ServerSelectModal({ servers, selectedServers, onConfirm, onClose }: ServerSelectModalProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set(selectedServers.map(s => s.id)));

    const toggleServer = (server: ServerInfo) => {
        const newSelected = new Set(selected);
        if (newSelected.has(server.id)) {
            newSelected.delete(server.id);
        } else {
            newSelected.add(server.id);
        }
        setSelected(newSelected);
    };

    const handleConfirm = () => {
        const selectedServerList = servers.filter(s => selected.has(s.id));
        onConfirm(selectedServerList);
    };

    // Group servers by environment
    const groupedServers = servers.reduce((acc, server) => {
        const env = server.environment || "未分类";
        if (!acc[env]) acc[env] = [];
        acc[env].push(server);
        return acc;
    }, {} as Record<string, ServerInfo[]>);

    const getEnvColor = (env: string) => {
        switch (env) {
            case "Production": return "#10b981";
            case "Test": return "#f59e0b";
            case "Development": return "#3B82F6";
            case "Staging": return "#8B5CF6";
            default: return "#94A3B8";
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="server-select-modal" onClick={e => e.stopPropagation()}>
                <header className="select-modal-header">
                    <h3>
                        <Server size={20} />
                        选择目标服务器
                    </h3>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </header>

                <div className="select-modal-body">
                    {servers.length === 0 ? (
                        <div className="empty-servers">
                            <Server size={40} strokeWidth={1} />
                            <p>暂无可用服务器</p>
                            <span>请先在服务器配置中添加服务器</span>
                        </div>
                    ) : (
                        Object.entries(groupedServers).map(([env, envServers]) => (
                            <div key={env} className="server-group">
                                <div className="server-group-header">
                                    <span
                                        className="env-badge"
                                        style={{ backgroundColor: `${getEnvColor(env)}20`, color: getEnvColor(env) }}
                                    >
                                        {env}
                                    </span>
                                    <span className="server-count">{envServers.length} 台服务器</span>
                                </div>
                                <div className="server-list">
                                    {envServers.map(server => (
                                        <label key={server.id} className={`server-item ${selected.has(server.id) ? 'selected' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={selected.has(server.id)}
                                                onChange={() => toggleServer(server)}
                                            />
                                            <div className="server-item-content">
                                                <div className="server-item-main">
                                                    <span className="server-ip">{server.host}</span>
                                                    <span className={`status-dot ${server.status === 'online' ? 'online' : 'offline'}`}></span>
                                                </div>
                                                <span className="server-desc">{server.description || '无备注'}</span>
                                            </div>
                                            <div className="checkbox-indicator">
                                                {selected.has(server.id) && <Check size={16} />}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <footer className="select-modal-footer">
                    <span className="selected-count">已选择 {selected.size} 台服务器</span>
                    <div className="footer-buttons">
                        <button className="btn btn-secondary" onClick={onClose}>取消</button>
                        <button className="btn btn-primary" onClick={handleConfirm}>
                            <Check size={16} />
                            确认选择
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}

interface ResultCardProps {
    result: SearchResultState;
    onViewDetail?: () => void;
    onDownload?: () => void;
}

function ResultCard({ result, onViewDetail, onDownload }: ResultCardProps) {
    const { name, ip, path, status, matchCount, fileCount, duration, error } = result;
    return (
        <div className={`result-card ${status}`}>
            {status === "loading" && (
                <div className="live-indicator">
                    <span className="live-dot"></span>
                </div>
            )}

            <div className="card-header">
                <div>
                    <div className="card-title">
                        <h4>{name}</h4>
                        <span className="ip-badge">{ip}</span>
                    </div>
                    <p className="card-path" title={path}>{path}</p>
                </div>
                {status === "completed" && (
                    <div className="status-icon success">
                        <Check size={20} />
                    </div>
                )}
                {status === "error" && (
                    <div className="status-icon error">
                        <AlertCircle size={20} />
                    </div>
                )}
            </div>

            {status === "completed" && (
                <>
                    <div className="stats-grid">
                        <div className="stat-box">
                            <p className="stat-label">日志文件</p>
                            <p className="stat-value">{fileCount} 个</p>
                        </div>
                        <div className="stat-box">
                            <p className="stat-label">{matchCount > 0 ? '匹配行数' : '耗时'}</p>
                            <p className="stat-value">{matchCount > 0 ? matchCount : duration}</p>
                        </div>
                    </div>
                    <div className="card-actions">
                        <button className="btn btn-secondary" onClick={onViewDetail}>
                            <Eye size={16} />
                            <span>查看详情</span>
                        </button>
                        <button className="btn btn-secondary" onClick={onDownload} title="导出结果" style={{ flex: '0 0 auto', padding: '0 12px' }}>
                            <Download size={18} />
                        </button>
                    </div>
                </>
            )}

            {status === "loading" && (
                <>
                    <div className="loading-content">
                        <div className="spinner"></div>
                        <p className="loading-text">正在搜索日志...</p>
                    </div>
                    <div className="card-actions">
                        <button className="btn btn-secondary" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                            等待中...
                        </button>
                        <button className="btn btn-secondary" style={{ color: 'var(--color-error)', flex: '0 0 auto', padding: '0 12px' }}>
                            <X size={18} />
                        </button>
                    </div>
                </>
            )}

            {status === "error" && error && (
                <>
                    <div className="error-box">
                        <Wifi size={18} className="error-icon" />
                        <div>
                            <p className="error-title">{error.title}</p>
                            <p className="error-message">{error.message}</p>
                        </div>
                    </div>
                    <div className="card-actions">
                        <button className="btn btn-secondary">
                            <RefreshCw size={16} />
                            <span>重试</span>
                        </button>
                        <button className="btn btn-secondary">
                            查看日志
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

// Log Detail Modal Component
interface LogDetailModalProps {
    data: ModalData;
    onClose: () => void;
}

function LogDetailModal({ data, onClose }: LogDetailModalProps) {
    const [selectedFile, setSelectedFile] = useState<LogFileInfo | null>(null);
    const [logContent, setLogContent] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState(data.traceId || "");
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const [wrapText, setWrapText] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const logViewerRef = useRef<HTMLDivElement>(null);

    const handleFileSelect = async (file: LogFileInfo) => {
        setSelectedFile(file);
        setIsLoading(true);
        setLogContent("");
        // Auto-fill the search query with traceId
        setSearchQuery(data.traceId || "");

        try {
            const content = await invoke<string>("read_log_file", {
                host: data.serverInfo.host,
                port: data.serverInfo.port,
                username: data.serverInfo.username,
                password: data.serverInfo.password,
                filePath: file.path,
                traceId: data.traceId || "",
                maxLines: 5000,
            });
            setLogContent(content);
            // Reset match index to 0 (first match)
            setCurrentMatchIndex(0);
        } catch (error) {
            setLogContent(`Error loading file: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const highlightSearch = (text: string, query: string) => {
        if (!query) return text;
        try {
            const regex = new RegExp(`(${query})`, 'gi');
            const parts = text.split(regex);
            return parts.map((part, i) =>
                regex.test(part) ? <mark key={i} className="search-highlight">{part}</mark> : part
            );
        } catch {
            return text;
        }
    };

    const logLines = logContent.split('\n').filter(line => line.trim());

    // Find all matching line indices
    const matchingLineIndices = searchQuery
        ? logLines.map((line, idx) =>
            line.toLowerCase().includes(searchQuery.toLowerCase()) ? idx : -1
        ).filter(idx => idx !== -1)
        : [];

    const matchCount = matchingLineIndices.length;

    // Navigate to previous match
    const goToPrevMatch = () => {
        if (matchCount === 0) return;
        const newIndex = currentMatchIndex > 0 ? currentMatchIndex - 1 : matchCount - 1;
        setCurrentMatchIndex(newIndex);
        scrollToMatch(matchingLineIndices[newIndex]);
    };

    // Navigate to next match
    const goToNextMatch = () => {
        if (matchCount === 0) return;
        const newIndex = currentMatchIndex < matchCount - 1 ? currentMatchIndex + 1 : 0;
        setCurrentMatchIndex(newIndex);
        scrollToMatch(matchingLineIndices[newIndex]);
    };

    // Scroll to a specific line and center it in the viewport
    const scrollToMatch = (lineIndex: number) => {
        const container = logViewerRef.current;
        if (container) {
            const lineElement = container.querySelector(`[data-line-index="${lineIndex}"]`);
            if (lineElement) {
                const containerRect = container.getBoundingClientRect();
                const elementRect = lineElement.getBoundingClientRect();
                const scrollOffset = elementRect.top - containerRect.top - (containerRect.height / 2) + (elementRect.height / 2);
                container.scrollTop += scrollOffset;
            }
        }
    };

    // Navigate to last match
    const goToLastMatch = () => {
        if (matchCount === 0) return;
        const lastIndex = matchCount - 1;
        setCurrentMatchIndex(lastIndex);
        scrollToMatch(matchingLineIndices[lastIndex]);
    };

    // Navigate to first match
    const goToFirstMatch = () => {
        if (matchCount === 0) return;
        setCurrentMatchIndex(0);
        scrollToMatch(matchingLineIndices[0]);
    };

    // Copy log content to clipboard
    const handleCopy = async () => {
        try {
            let contentToCopy = logContent;

            // If there are matches, copy only the current match line
            if (matchingLineIndices.length > 0) {
                const currentLineIdx = matchingLineIndices[currentMatchIndex];
                if (logLines[currentLineIdx]) {
                    contentToCopy = logLines[currentLineIdx];
                }
            }

            await navigator.clipboard.writeText(contentToCopy);
            alert("日志内容已复制到剪贴板");
        } catch (error) {
            console.error("Copy failed:", error);
            alert("复制失败");
        }
    };

    // Download log file with save dialog
    const handleDownload = async () => {
        if (!selectedFile || !logContent) return;
        try {
            const { save } = await import('@tauri-apps/plugin-dialog');
            const filePath = await save({
                defaultPath: selectedFile.name,
                filters: [{ name: 'Log Files', extensions: ['log', 'txt'] }]
            });
            if (filePath) {
                await invoke('write_file', {
                    path: filePath,
                    content: logContent
                });
                alert('文件已保存到: ' + filePath);
            }
        } catch (error) {
            console.error('Download failed:', error);
            alert('下载失败: ' + error);
        }
    };

    // Auto-scroll to first match when content loads
    useEffect(() => {
        if (!isLoading && matchingLineIndices.length > 0 && selectedFile) {
            setTimeout(() => {
                scrollToMatch(matchingLineIndices[0]);
            }, 100);
        }
    }, [isLoading, logContent, selectedFile]);

    // Toggle fullscreen using Tauri window API
    const toggleFullscreen = async () => {
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const appWindow = getCurrentWindow();
            const isCurrentlyFullscreen = await appWindow.isFullscreen();
            await appWindow.setFullscreen(!isCurrentlyFullscreen);
            setIsFullscreen(!isCurrentlyFullscreen);
        } catch (error) {
            console.error('Fullscreen toggle failed:', error);
            // Fallback: just toggle the CSS fullscreen state
            setIsFullscreen(!isFullscreen);
        }
    };

    // Listen for ESC key to exit fullscreen
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullscreen) {
                try {
                    const { getCurrentWindow } = await import('@tauri-apps/api/window');
                    const appWindow = getCurrentWindow();
                    await appWindow.setFullscreen(false);
                    setIsFullscreen(false);
                } catch (error) {
                    setIsFullscreen(false);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFullscreen]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className={`log-detail-modal ${isFullscreen ? 'fullscreen' : ''}`} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <header className="modal-header">
                    <div className="modal-title-group">
                        <div className="modal-icon">
                            <FileText size={22} />
                        </div>
                        <div className="modal-title-text">
                            <h2>{selectedFile ? selectedFile.name : '选择日志文件'}</h2>
                            <span className="modal-subtitle">{data.name} - {data.ip}</span>
                        </div>
                    </div>
                    <div className="modal-header-right">
                        <div className="server-badge">
                            <Server size={14} />
                            <span>{data.ip}:{data.serverInfo.port}</span>
                        </div>
                        <button className="modal-close-btn" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>
                </header>

                <div className="modal-body">
                    <div className="file-sidebar">
                        <div className="sidebar-header">
                            <h3>日志文件 ({data.files.length})</h3>
                        </div>
                        <div className="file-list">
                            {data.files.map((file, idx) => (
                                <div
                                    key={idx}
                                    className={`file-item ${selectedFile?.path === file.path ? 'active' : ''}`}
                                    onClick={() => handleFileSelect(file)}
                                >
                                    <FileText size={16} />
                                    <div className="file-info">
                                        <span className="file-name" title={file.name}>{file.name}</span>
                                        <div className="file-meta">
                                            <span className="match-tag">
                                                {file.match_count} 处匹配
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="log-content-area">
                        {selectedFile ? (
                            <>
                                <div className="log-toolbar">
                                    <div className="search-controls">
                                        <div className="search-input-wrapper">
                                            <Search size={16} />
                                            <input
                                                type="text"
                                                placeholder="在结果中搜索..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                            {matchCount > 0 && (
                                                <span className="match-indicator">
                                                    {currentMatchIndex + 1} / {matchCount}
                                                </span>
                                            )}
                                        </div>
                                        <div className="nav-buttons">
                                            <button onClick={goToPrevMatch} disabled={matchCount === 0} title="上一个 (Shift+Enter)">
                                                <ChevronUp size={18} />
                                            </button>
                                            <button onClick={goToNextMatch} disabled={matchCount === 0} title="下一个 (Enter)">
                                                <ChevronDown size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="action-buttons">
                                        <button
                                            className={`tool-btn ${isFullscreen ? 'active' : ''}`}
                                            onClick={toggleFullscreen}
                                            title={isFullscreen ? "退出全屏 (ESC)" : "全屏显示"}
                                        >
                                            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                        </button>
                                        <button className="tool-btn" onClick={goToLastMatch} disabled={matchCount === 0} title="跳转到最后一个匹配">
                                            <ArrowDownToLine size={18} />
                                        </button>
                                        <button className="tool-btn" onClick={goToFirstMatch} disabled={matchCount === 0} title="跳转到第一个匹配">
                                            <ArrowDownToLine size={18} style={{ transform: 'rotate(180deg)' }} />
                                        </button>
                                        <button
                                            className={`tool-btn ${wrapText ? 'active' : ''}`}
                                            onClick={() => setWrapText(!wrapText)}
                                            title="自动换行"
                                        >
                                            <WrapText size={18} />
                                        </button>
                                        <div className="divider"></div>
                                        <button className="tool-btn" onClick={handleCopy} title="复制当前行 (如果有匹配) 或全文">
                                            <Copy size={18} />
                                        </button>
                                        <button className="tool-btn" onClick={handleDownload} title="下载文件">
                                            <Download size={18} />
                                        </button>
                                    </div>
                                </div>

                                {isLoading ? (
                                    <div className="log-loading">
                                        <div className="spinner"></div>
                                        <p>正在读取日志内容...</p>
                                    </div>
                                ) : (
                                    <div className={`log-viewer ${wrapText ? 'wrap-text' : ''}`} ref={logViewerRef}>
                                        {logLines.map((line, idx) => {
                                            const isMatch = matchingLineIndices.includes(idx);
                                            const isCurrentMatch = matchingLineIndices[currentMatchIndex] === idx;

                                            // Only render lines around matches if the file is huge? 
                                            // For now rendering all, but with virtualization it would be better.
                                            // Simple optimization: just render all for now, assuming 5000 lines is handled by browser.

                                            return (
                                                <div
                                                    key={idx}
                                                    data-line-index={idx}
                                                    className={`log-line ${isMatch ? 'has-match' : ''} ${isCurrentMatch ? 'current-match' : ''}`}
                                                >
                                                    <span className="line-number">{idx + 1}</span>
                                                    <span className="line-content">
                                                        {highlightSearch(line, searchQuery)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        {logLines.length === 0 && (
                                            <div className="empty-log">
                                                <p>该文件为空或无法读取</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="no-file-selected">
                                <FileText size={48} strokeWidth={1} />
                                <p>请选择左侧的日志文件以查看详情</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Export Progress Modal
function ExportProgressModal({ status, onClose }: { status: ExportStatus, onClose: () => void }) {
    return (
        <div className="modal-overlay">
            <div className="export-modal" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <div className="modal-title-group">
                        <div className="modal-icon">
                            <Download size={22} />
                        </div>
                        <div className="modal-title-text">
                            <h2>导出结果</h2>
                            <span className="modal-subtitle">
                                {status.isExporting ? '正在导出...' : '导出完成'}
                            </span>
                        </div>
                    </div>
                    {!status.isExporting && (
                        <button className="modal-close-btn" onClick={onClose}>
                            <X size={20} />
                        </button>
                    )}
                </header>

                <div className="modal-body export-body">
                    <div className="export-progress-section">
                        <div className="progress-info">
                            <span className="current-file">{status.currentFile}</span>
                            <span className="progress-count">{status.current} / {status.total}</span>
                        </div>
                        <div className="progress-bar-container">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${(status.current / status.total) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="export-logs">
                        {status.logs.map((log, idx) => (
                            <div key={idx} className={`log-entry ${log.includes('失败') ? 'error' : ''} ${log.includes('成功') ? 'success' : ''}`}>
                                {log}
                            </div>
                        ))}
                    </div>
                </div>

                {!status.isExporting && (
                    <div className="modal-footer">
                        <button className="btn btn-primary" onClick={onClose}>关闭</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// Node Detail Modal Component
interface NodeDetailModalProps {
    node: any;
    data: NodeDetailResponse | null;
    isLoading: boolean;
    onClose: () => void;
}

function NodeDetailModal({ node, data, isLoading, onClose }: NodeDetailModalProps) {
    const [activeIOTab, setActiveIOTab] = useState<'input' | 'output'>('input');
    const [copySuccess, setCopySuccess] = useState(false);

    // Handle copy to clipboard
    const handleCopy = async () => {
        const serviceIO = data?.data?.[0]?.serviceIOList?.[0];
        if (!serviceIO) return;

        const textToCopy = activeIOTab === 'input'
            ? formatJson(serviceIO.input)
            : formatJson(serviceIO.output);

        try {
            await navigator.clipboard.writeText(textToCopy);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Format JSON for display
    const formatJson = (jsonString: string): string => {
        try {
            const parsed = JSON.parse(jsonString);
            return JSON.stringify(parsed, null, 2);
        } catch {
            return jsonString;
        }
    };

    // Get status info
    const getStatusInfo = () => {
        if (!data || !data.data || data.data.length === 0) return null;
        const rootCause = data.data[0].rootCauseAnalysisList?.[0];
        if (!rootCause) return null;

        const isSuccess = rootCause.responseCode === '000000000000';
        return {
            isSuccess,
            code: rootCause.responseCode,
            message: rootCause.responseMessage,
            exceptionStack: rootCause.exceptionStack
        };
    };

    const statusInfo = getStatusInfo();
    const serviceIO = data?.data?.[0]?.serviceIOList?.[0];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="node-detail-modal" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <h3>
                        <FileText size={20} />
                        节点详情 - {node?.service || 'Unknown'}
                    </h3>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </header>

                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    {isLoading ? (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '48px',
                            gap: '12px',
                            color: 'var(--color-text-muted)'
                        }}>
                            <Loader2 size={24} className="spin" />
                            <span>加载中...</span>
                        </div>
                    ) : (
                        <>
                            {/* Node Basic Info */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '12px',
                                marginBottom: '20px',
                                padding: '16px',
                                background: 'var(--color-surface-dark)',
                                borderRadius: '8px'
                            }}>
                                <div>
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>服务名称</span>
                                    <div style={{ fontWeight: 600 }}>{node?.service}</div>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>IP 地址</span>
                                    <div style={{ fontFamily: 'var(--font-mono)' }}>{node?.ip}</div>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>时间</span>
                                    <div>{node?.time}</div>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>耗时</span>
                                    <div>{node?.duration}</div>
                                </div>
                            </div>

                            {/* Status Section */}
                            {statusInfo && (
                                <div style={{
                                    marginBottom: '20px',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    background: statusInfo.isSuccess
                                        ? 'rgba(16, 185, 129, 0.1)'
                                        : 'rgba(239, 68, 68, 0.1)',
                                    border: `1px solid ${statusInfo.isSuccess ? 'var(--color-success)' : 'var(--color-error)'}`
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '8px'
                                    }}>
                                        {statusInfo.isSuccess ? (
                                            <CheckCircle2 size={18} color="var(--color-success)" />
                                        ) : (
                                            <XCircle size={18} color="var(--color-error)" />
                                        )}
                                        <span style={{ fontWeight: 600 }}>
                                            {statusInfo.isSuccess ? '交易成功' : '交易失败'}
                                        </span>
                                    </div>
                                    <div style={{
                                        fontSize: '13px',
                                        color: 'var(--color-text-muted)',
                                        fontFamily: 'var(--font-mono)'
                                    }}>
                                        <div>响应码: {statusInfo.code}</div>
                                        <div>响应信息: {statusInfo.message}</div>
                                        {statusInfo.exceptionStack && (
                                            <div style={{
                                                marginTop: '8px',
                                                color: 'var(--color-error)',
                                                whiteSpace: 'pre-wrap'
                                            }}>
                                                异常堆栈: {statusInfo.exceptionStack}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* I/O Tabs */}
                            {serviceIO && (
                                <div>
                                    <div style={{
                                        display: 'flex',
                                        gap: '4px',
                                        marginBottom: '12px',
                                        borderBottom: '1px solid var(--color-border)',
                                        paddingBottom: '8px'
                                    }}>
                                        <button
                                            className={`io-tab ${activeIOTab === 'input' ? 'active' : ''}`}
                                            onClick={() => setActiveIOTab('input')}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '6px 6px 0 0',
                                                border: 'none',
                                                background: activeIOTab === 'input'
                                                    ? 'var(--color-primary)'
                                                    : 'transparent',
                                                color: activeIOTab === 'input'
                                                    ? 'white'
                                                    : 'var(--color-text-muted)',
                                                cursor: 'pointer',
                                                fontWeight: 500
                                            }}
                                        >
                                            请求报文 (Input)
                                        </button>
                                        <button
                                            className={`io-tab ${activeIOTab === 'output' ? 'active' : ''}`}
                                            onClick={() => setActiveIOTab('output')}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '6px 6px 0 0',
                                                border: 'none',
                                                background: activeIOTab === 'output'
                                                    ? 'var(--color-primary)'
                                                    : 'transparent',
                                                color: activeIOTab === 'output'
                                                    ? 'white'
                                                    : 'var(--color-text-muted)',
                                                cursor: 'pointer',
                                                fontWeight: 500
                                            }}
                                        >
                                            响应报文 (Output)
                                        </button>

                                        {/* Copy Button */}
                                        <button
                                            onClick={handleCopy}
                                            style={{
                                                marginLeft: 'auto',
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid var(--color-border)',
                                                background: copySuccess ? 'var(--color-success)' : 'var(--color-surface-dark)',
                                                color: copySuccess ? 'white' : 'var(--color-text-muted)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {copySuccess ? <Check size={14} /> : <Copy size={14} />}
                                            {copySuccess ? '已复制' : '复制'}
                                        </button>
                                    </div>

                                    <pre style={{
                                        background: 'var(--color-surface-dark)',
                                        padding: '16px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontFamily: 'var(--font-mono)',
                                        overflow: 'auto',
                                        maxHeight: '300px',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-all',
                                        margin: 0,
                                        lineHeight: '1.5'
                                    }}>
                                        {activeIOTab === 'input'
                                            ? formatJson(serviceIO.input)
                                            : formatJson(serviceIO.output)
                                        }
                                    </pre>
                                </div>
                            )}

                            {!serviceIO && !isLoading && (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '24px',
                                    color: 'var(--color-text-muted)'
                                }}>
                                    暂无报文数据
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-primary" onClick={onClose}>关闭</button>
                </div>
            </div>
        </div>
    );
}
