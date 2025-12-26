import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw, ArrowRight, Settings, Download, Info, AlertTriangle, WifiOff, CheckCircle } from "lucide-react";
import "./Overview.css";

// System Info Interface (matches Rust struct)
interface SystemInfo {
    cpu_usage: number;
    memory_used_gb: number;
    memory_total_gb: number;
    memory_usage_percent: number;
}

// Server Info Interface
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

// Search History Item Interface
interface SearchHistoryItem {
    id: string;
    traceId: string;
    logPath: string;
    serverIds: string[];
    serverNames: string[];
    timestamp: number;
    totalMatchCount?: number;
}

// Static Data
const STATS = {
    version: "v1.0.2",
    lastUpdate: "2 天前"
};

const NOTIFICATIONS = [
    { type: "download", title: "日志导出就绪", desc: "您申请的 CSV 格式日志文件已生成。", time: "2m", action: "下载文件" },
    { type: "warning", title: "系统维护提醒", desc: "今晚 02:00 将进行服务器例行维护。", time: "2h" },
    { type: "info", title: "新版本可用", desc: "V 1.0.3 包含针对大文件搜索的性能优化。", time: "1d" },
];

const HISTORY_STORAGE_KEY = 'log_search_history';

export function Overview() {
    const [systemInfo, setSystemInfo] = useState<SystemInfo>({
        cpu_usage: 0,
        memory_used_gb: 0,
        memory_total_gb: 0,
        memory_usage_percent: 0
    });

    // Real data states
    const [servers, setServers] = useState<ServerInfo[]>([]);
    const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);

    const fetchSystemInfo = async () => {
        try {
            const info = await invoke<SystemInfo>("get_system_info");
            setSystemInfo(info);
        } catch (error) {
            console.error("Failed to fetch system info:", error);
        }
    };

    const loadServers = async () => {
        try {
            const serverList = await invoke<ServerInfo[]>("list_servers");
            setServers(serverList);
        } catch (error) {
            console.error("Failed to load servers:", error);
        }
    };

    const loadSearchHistory = () => {
        try {
            const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
            if (stored) {
                setSearchHistory(JSON.parse(stored).slice(0, 5)); // Show last 5
            }
        } catch (error) {
            console.error("Failed to load search history:", error);
        }
    };

    // Helper to format time ago
    const formatTimeAgo = (timestamp: number): string => {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes} 分钟前`;
        if (hours < 24) return `${hours} 小时前`;
        return `${days} 天前`;
    };

    useEffect(() => {
        fetchSystemInfo();
        loadServers();
        loadSearchHistory();
        // Refresh system info every 3 seconds
        const interval = setInterval(fetchSystemInfo, 3000);
        return () => clearInterval(interval);
    }, []);

    // Computed values
    const offlineServers = servers.filter(s => s.status === 'offline');
    const onlineServers = servers.filter(s => s.status === 'online');
    const totalServers = servers.length;
    return (
        <div className="overview-page">
            {/* Header */}
            <header className="page-header">
                <div className="page-title">
                    <h2>概览</h2>
                    <p>系统运行状态与关键指标监控</p>
                </div>
                <div className="header-actions">
                    <div className="system-status">
                        <span className="status-dot"></span>
                        系统运行正常
                    </div>
                    <button className="icon-btn-header">
                        <RefreshCw size={18} />
                    </button>
                </div>
            </header>

            {/* Body */}
            <div className="content-body">
                <div className="container-inner">
                    {/* Stats Cards */}
                    <div className="stats-row">
                        {/* Version Card */}
                        <div className="stat-card">
                            <div className="stat-card-header">
                                <div>
                                    <p className="stat-label">系统版本</p>
                                    <h3 className="stat-value">{STATS.version} <span className="stat-suffix">Latest</span></h3>
                                </div>
                                <div className="stat-icon primary">
                                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                </div>
                            </div>
                            <div className="stat-card-footer">
                                <div className="progress-info">
                                    <span>上次更新</span>
                                    <span>{STATS.lastUpdate}</span>
                                </div>
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: '100%' }}></div>
                                </div>
                            </div>
                        </div>

                        {/* CPU/Memory Card */}
                        <div className="stat-card">
                            <div className="stat-card-header">
                                <div>
                                    <p className="stat-label">CPU / 内存</p>
                                    <h3 className="stat-value">{Math.round(systemInfo.cpu_usage)}% <span className="stat-suffix">/ {systemInfo.memory_used_gb.toFixed(1)}GB</span></h3>
                                </div>
                                <div className="stat-icon blue">
                                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <rect x="4" y="4" width="16" height="16" rx="2" />
                                        <path d="M9 9h6v6H9z" />
                                        <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
                                    </svg>
                                </div>
                            </div>
                            <div className="stat-card-footer">
                                <div className="dual-progress">
                                    <div className="progress-row">
                                        <span className="progress-label">CPU</span>
                                        <div className="progress-bar">
                                            <div className="progress-fill blue" style={{ width: `${Math.min(systemInfo.cpu_usage, 100)}%` }}></div>
                                        </div>
                                    </div>
                                    <div className="progress-row">
                                        <span className="progress-label">RAM</span>
                                        <div className="progress-bar">
                                            <div className="progress-fill purple" style={{ width: `${Math.min(systemInfo.memory_usage_percent, 100)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Servers Card */}
                        <div className="stat-card">
                            <div className="stat-card-header">
                                <div>
                                    <p className="stat-label">服务器状态</p>
                                    <h3 className="stat-value">{totalServers} <span className="stat-suffix">Total</span></h3>
                                </div>
                                <div className="stat-icon green">
                                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <rect x="2" y="2" width="20" height="8" rx="2" />
                                        <rect x="2" y="14" width="20" height="8" rx="2" />
                                        <circle cx="6" cy="6" r="1" fill="currentColor" />
                                        <circle cx="6" cy="18" r="1" fill="currentColor" />
                                    </svg>
                                </div>
                            </div>
                            <div className="stat-card-footer">
                                <div className="server-status-grid">
                                    <div className="server-status-item online">
                                        <span className="status-indicator"></span>
                                        <span>{onlineServers.length} 在线</span>
                                    </div>
                                    <div className="server-status-item offline">
                                        <span className="status-indicator"></span>
                                        <span>{offlineServers.length} 离线</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tasks Card */}
                        <div className="stat-card task-card">
                            <div className="stat-card-header">
                                <div>
                                    <p className="stat-label">最近任务</p>
                                    <h3 className="stat-value">{searchHistory.length} <span className="stat-suffix">已完成</span></h3>
                                </div>
                                <div className="stat-icon orange">
                                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="stat-card-footer">
                                <div className="task-list">
                                    {searchHistory.length === 0 ? (
                                        <div className="task-item" style={{ justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                                            暂无任务记录
                                        </div>
                                    ) : (
                                        searchHistory.slice(0, 2).map((item) => (
                                            <div key={item.id} className="task-item">
                                                <span className="task-content">
                                                    <CheckCircle size={12} className="success" />
                                                    搜索: {item.traceId.length > 15 ? item.traceId.slice(0, 15) + '...' : item.traceId}
                                                </span>
                                                <span className="task-time">{formatTimeAgo(item.timestamp)}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Grid */}
                    <div className="main-grid">
                        {/* Recent Searches Table */}
                        <div className="panel table-panel">
                            <div className="panel-header">
                                <h3>
                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    最近搜索活动
                                </h3>
                                <button className="view-all-btn">
                                    查看全部
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                            <div className="panel-content">
                                <table className="search-table">
                                    <thead>
                                        <tr>
                                            <th>任务 ID</th>
                                            <th>搜索内容 / 路径</th>
                                            <th className="center">涉及服务器</th>
                                            <th>状态</th>
                                            <th className="right">匹配行数</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {searchHistory.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                                                    暂无搜索记录
                                                </td>
                                            </tr>
                                        ) : (
                                            searchHistory.map((item, index) => (
                                                <tr key={item.id}>
                                                    <td>
                                                        <span className="task-id">#{String(index + 1).padStart(4, '0')}</span>
                                                        <div className="task-time-cell">{formatTimeAgo(item.timestamp)}</div>
                                                    </td>
                                                    <td>
                                                        <div className="search-keyword">{item.traceId.length > 25 ? item.traceId.slice(0, 25) + '...' : item.traceId}</div>
                                                        <div className="search-path" title={item.logPath}>{item.logPath}</div>
                                                    </td>
                                                    <td className="center">
                                                        <span className="server-count">{item.serverNames.length} 台</span>
                                                    </td>
                                                    <td>
                                                        <span className="status-tag success">
                                                            <span className="status-dot-tag"></span>
                                                            已完成
                                                        </span>
                                                    </td>
                                                    <td className="right">
                                                        <span className="match-count">
                                                            {item.totalMatchCount !== undefined ? item.totalMatchCount.toLocaleString() : '-'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="right-column">
                            {/* Offline Servers Panel */}
                            <div className="panel error-panel">
                                <div className="panel-header error">
                                    <h3>
                                        <WifiOff size={16} />
                                        连接异常服务器
                                    </h3>
                                    <span className="error-count">{offlineServers.length}</span>
                                </div>
                                <div className="panel-content">
                                    <div className="server-list">
                                        {offlineServers.length === 0 ? (
                                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                                所有服务器连接正常
                                            </div>
                                        ) : (
                                            offlineServers.map(server => (
                                                <div key={server.id} className="server-item">
                                                    <div className="server-status-dot"></div>
                                                    <div className="server-info">
                                                        <div className="server-name-row">
                                                            <h4>{server.description || server.host}</h4>
                                                            <span className="server-ip">{server.host}</span>
                                                        </div>
                                                        <p className="server-error">连接失败</p>
                                                    </div>
                                                    <button className="server-action-btn">
                                                        <Settings size={16} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Notifications Panel */}
                            <div className="panel notifications-panel">
                                <div className="panel-header">
                                    <h3>
                                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                        消息通知
                                    </h3>
                                    <button className="mark-read-btn">全部已读</button>
                                </div>
                                <div className="panel-content">
                                    <div className="notification-list">
                                        {NOTIFICATIONS.map((notif, i) => (
                                            <div key={i} className="notification-item">
                                                <div className={`notif-icon ${notif.type}`}>
                                                    {notif.type === 'download' && <Download size={16} />}
                                                    {notif.type === 'warning' && <AlertTriangle size={16} />}
                                                    {notif.type === 'info' && <Info size={16} />}
                                                </div>
                                                <div className="notif-content">
                                                    <p className="notif-title">{notif.title}</p>
                                                    <p className="notif-desc">{notif.desc}</p>
                                                    {notif.action && (
                                                        <button className="notif-action-btn">{notif.action}</button>
                                                    )}
                                                </div>
                                                <span className="notif-time">{notif.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
