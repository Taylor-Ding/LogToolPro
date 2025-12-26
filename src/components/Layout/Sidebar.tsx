import { Terminal, LayoutDashboard, Search, Server, Settings } from "lucide-react";
import "./Sidebar.css";

interface SidebarProps {
    activePage: string;
    onNavigate: (page: string) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
    const navItems = [
        { id: "overview", label: "概览", icon: LayoutDashboard },
        { id: "log-search", label: "日志搜索", icon: Search },
        { id: "server-config", label: "服务器配置", icon: Server },
        { id: "settings", label: "系统设置", icon: Settings },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="brand">
                    <Terminal className="brand-icon" size={24} strokeWidth={2.5} />
                    <span className="brand-text">LogTool Pro</span>
                </div>
                <p className="version">V 1.0.2</p>
            </div>

            <nav className="nav-menu">
                {navItems.map(item => (
                    <a
                        key={item.id}
                        href="#"
                        className={`nav-item ${activePage === item.id ? "active" : ""}`}
                        onClick={(e) => {
                            e.preventDefault();
                            onNavigate(item.id);
                        }}
                    >
                        <item.icon className="nav-icon" size={20} />
                        <span>{item.label}</span>
                    </a>
                ))}
            </nav>
        </aside>
    );
}
