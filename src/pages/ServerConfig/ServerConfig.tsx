import { useState, useEffect } from "react";
import { Plus, Upload, Download, Search, RefreshCw, Edit, Trash2, Server as ServerIcon, Loader2, ChevronDown, ChevronRight, Terminal } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { ServerDrawer } from "../../components/Drawer/ServerDrawer";
import { TerminalModal } from "../../components/Terminal/TerminalModal";
import "./ServerConfig.css";

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

export function ServerConfig() {
    const [filter, setFilter] = useState("all");
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [servers, setServers] = useState<ServerInfo[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingServer, setEditingServer] = useState<ServerInfo | null>(null);
    const [testingServerId, setTestingServerId] = useState<string | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [terminalServer, setTerminalServer] = useState<ServerInfo | null>(null);

    const loadServers = async () => {
        try {
            const result = await invoke<ServerInfo[]>("list_servers");
            setServers(result);
        } catch (error) {
            console.error("Failed to load servers:", error);
        }
    };

    useEffect(() => {
        loadServers();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this server?")) return;
        try {
            await invoke("delete_server", { id });
            loadServers();
        } catch (error) {
            console.error("Failed to delete server:", error);
        }
    };

    const handleEdit = (server: ServerInfo) => {
        setEditingServer(server);
        setIsDrawerOpen(true);
    };

    const handleAddNew = () => {
        setEditingServer(null);
        setIsDrawerOpen(true);
    };

    const handleDrawerClose = () => {
        setIsDrawerOpen(false);
        setEditingServer(null);
    };

    const handleTestConnection = async (server: ServerInfo) => {
        setTestingServerId(server.id);
        try {
            await invoke<string>("test_ssh_connection", {
                host: server.host,
                port: server.port,
                username: server.username,
                password: server.password,
            });
            await invoke("save_server", {
                server: { ...server, status: "online" },
            });
            loadServers();
        } catch (error) {
            await invoke("save_server", {
                server: { ...server, status: "offline" },
            });
            loadServers();
        } finally {
            setTestingServerId(null);
        }
    };

    const handleOpenTerminal = (server: ServerInfo) => {
        setTerminalServer(server);
    };

    const toggleGroup = (env: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(env)) {
                next.delete(env);
            } else {
                next.add(env);
            }
            return next;
        });
    };

    // Export servers to JSON file (with encrypted passwords)
    const handleExport = async () => {
        if (servers.length === 0) {
            alert("没有服务器信息可以导出");
            return;
        }

        // Open save dialog for user to choose path
        const filePath = await save({
            defaultPath: `servers-config-${new Date().toISOString().split('T')[0]}.json`,
            filters: [{
                name: 'JSON',
                extensions: ['json']
            }]
        });

        if (!filePath) return; // User cancelled

        try {
            // Fetch servers with encrypted passwords from backend
            const serversForExport = await invoke<ServerInfo[]>("list_servers_for_export");

            // Prepare export data with encrypted passwords
            const exportData = {
                version: "1.0",
                exportDate: new Date().toISOString(),
                servers: serversForExport.map(s => ({
                    host: s.host,
                    port: s.port,
                    username: s.username,
                    password: s.password, // This is now encrypted
                    description: s.description,
                    environment: s.environment,
                }))
            };

            // Write file using Tauri fs API
            await invoke("write_file", {
                path: filePath,
                content: JSON.stringify(exportData, null, 2)
            });
            alert("服务器配置导出成功! (密码已加密)");
        } catch (error) {
            console.error("Export failed:", error);
            alert("导出失败: " + error);
        }
    };

    // Import servers from JSON file
    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                if (!data.servers || !Array.isArray(data.servers)) {
                    alert("无效的配置文件格式");
                    return;
                }

                // Import each server
                let importedCount = 0;
                for (const serverData of data.servers) {
                    if (!serverData.host || !serverData.port || !serverData.username) {
                        continue; // Skip invalid entries
                    }

                    const newServer = {
                        id: crypto.randomUUID(),
                        host: serverData.host,
                        port: serverData.port,
                        username: serverData.username,
                        password: serverData.password || "",
                        description: serverData.description || "",
                        environment: serverData.environment || "Uncategorized",
                        status: "unknown",
                    };

                    await invoke("save_server", { server: newServer });
                    importedCount++;
                }

                alert(`成功导入 ${importedCount} 台服务器`);
                loadServers();
            } catch (error) {
                console.error("Import failed:", error);
                alert("导入失败: " + error);
            }
        };
        input.click();
    };

    // Filter servers based on status and search query
    const filteredServers = servers.filter(server => {
        const matchesFilter = filter === "all" ||
            (filter === "online" && server.status === "online") ||
            (filter === "offline" && (server.status === "offline" || server.status === "unknown"));
        const matchesSearch = searchQuery === "" ||
            server.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
            server.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    // Group servers by environment
    const groupedServers = filteredServers.reduce((acc, server) => {
        const env = server.environment || "Uncategorized";
        if (!acc[env]) acc[env] = [];
        acc[env].push(server);
        return acc;
    }, {} as Record<string, ServerInfo[]>);

    // Sort environments: Production first, then alphabetically
    const sortedEnvs = Object.keys(groupedServers).sort((a, b) => {
        if (a === "Production") return -1;
        if (b === "Production") return 1;
        return a.localeCompare(b);
    });

    const onlineCount = servers.filter(s => s.status === "online").length;
    const offlineCount = servers.filter(s => s.status === "offline" || s.status === "unknown").length;

    const getEnvColor = (env: string) => {
        switch (env) {
            case "Production": return "var(--color-success)";
            case "Test": return "var(--color-warning)";
            case "Development": return "#3B82F6";
            case "Staging": return "#8B5CF6";
            default: return "var(--color-text-muted)";
        }
    };

    return (
        <div className="server-config-page">
            {/* Header */}
            <header className="page-header">
                <div className="page-title">
                    <h2>服务器配置</h2>
                    <p>管理 Linux 服务器连接用于日志获取</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={handleImport}>
                        <Upload size={18} />
                        <span>Import</span>
                    </button>
                    <button className="btn btn-secondary" onClick={handleExport}>
                        <Download size={18} />
                        <span>Export</span>
                    </button>
                    <button className="btn btn-primary" onClick={handleAddNew}>
                        <Plus size={18} />
                        <span>Add Server</span>
                    </button>
                </div>
            </header>

            {/* Body */}
            <div className="content-body">
                <div className="container-inner">

                    {/* Filters */}
                    <div className="filters-bar">
                        <div className="server-search-wrapper">
                            <Search className="search-icon" size={18} />
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search IP or description..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="filter-tags">
                            <button
                                className={`filter-tag ${filter === 'all' ? 'active' : ''}`}
                                onClick={() => setFilter('all')}
                            >
                                All ({servers.length})
                            </button>
                            <button
                                className={`filter-tag ${filter === 'online' ? 'active' : ''}`}
                                onClick={() => setFilter('online')}
                            >
                                Online ({onlineCount})
                            </button>
                            <button
                                className={`filter-tag ${filter === 'offline' ? 'active' : ''}`}
                                onClick={() => setFilter('offline')}
                            >
                                Offline ({offlineCount})
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="table-card">
                        {filteredServers.length === 0 ? (
                            <div className="empty-state">
                                <ServerIcon size={48} strokeWidth={1} />
                                <p>No servers configured yet</p>
                                <button className="btn btn-primary" onClick={handleAddNew}>
                                    <Plus size={18} />
                                    <span>Add Your First Server</span>
                                </button>
                            </div>
                        ) : (
                            <table className="server-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '120px', textAlign: 'center' }}>Status</th>
                                        <th style={{ textAlign: 'center' }}>IP Address</th>
                                        <th style={{ textAlign: 'center' }}>Description</th>
                                        <th style={{ width: '180px', textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedEnvs.map(env => (
                                        <>
                                            {/* Environment Group Header */}
                                            <tr
                                                key={`group-${env}`}
                                                className="env-group-header"
                                                onClick={() => toggleGroup(env)}
                                            >
                                                <td colSpan={4}>
                                                    <div className="env-group-title">
                                                        {collapsedGroups.has(env) ? (
                                                            <ChevronRight size={18} />
                                                        ) : (
                                                            <ChevronDown size={18} />
                                                        )}
                                                        <span
                                                            className="env-group-badge"
                                                            style={{ backgroundColor: `${getEnvColor(env)}20`, color: getEnvColor(env) }}
                                                        >
                                                            {env}
                                                        </span>
                                                        <span className="env-group-count">
                                                            {groupedServers[env].length} server{groupedServers[env].length > 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                            {/* Server Rows */}
                                            {!collapsedGroups.has(env) && groupedServers[env].map(server => (
                                                <tr key={server.id}>
                                                    <td>
                                                        <div className={`status-badge status-${server.status === 'online' ? 'online' : 'offline'}`} style={{ margin: '0 auto' }}>
                                                            <div className="status-dot-wrapper">
                                                                {server.status === 'online' && <span className="status-ping"></span>}
                                                                <span className="status-dot"></span>
                                                            </div>
                                                            <span className="status-text capitalize">
                                                                {server.status === 'unknown' ? 'unknown' : server.status}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                                            <ServerIcon size={16} className="text-muted" style={{ opacity: 0.5 }} />
                                                            <span className="font-mono">{server.host}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                                                            {server.description || '-'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="row-actions" style={{ justifyContent: 'center' }}>
                                                            <button
                                                                className="action-btn terminal"
                                                                title="Open Terminal"
                                                                onClick={() => handleOpenTerminal(server)}
                                                            >
                                                                <Terminal size={16} />
                                                            </button>
                                                            <button
                                                                className="action-btn"
                                                                title="Test Connection"
                                                                onClick={() => handleTestConnection(server)}
                                                                disabled={testingServerId === server.id}
                                                            >
                                                                {testingServerId === server.id ? (
                                                                    <Loader2 size={16} className="spin" />
                                                                ) : (
                                                                    <RefreshCw size={16} />
                                                                )}
                                                            </button>
                                                            <button
                                                                className="action-btn"
                                                                title="Edit"
                                                                onClick={() => handleEdit(server)}
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                            <button
                                                                className="action-btn delete"
                                                                title="Delete"
                                                                onClick={() => handleDelete(server.id)}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                </div>
            </div>

            <ServerDrawer
                isOpen={isDrawerOpen}
                onClose={handleDrawerClose}
                onSuccess={(savedServer) => {
                    loadServers();
                    // Auto test connection for newly added/updated server
                    handleTestConnection(savedServer);
                }}
                editServer={editingServer}
            />

            <TerminalModal
                isOpen={!!terminalServer}
                onClose={() => setTerminalServer(null)}
                server={terminalServer}
            />
        </div>
    );
}
