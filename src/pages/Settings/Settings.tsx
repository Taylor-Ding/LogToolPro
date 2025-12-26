import { useState, useEffect } from "react";
import { Save, Sun, Moon, Monitor, Download, Link2Off, Bell, Volume2, Trash2, Terminal } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import "./Settings.css";

const SETTINGS_STORAGE_KEY = 'app_settings';

// Types
interface NotificationSetting {
    id: string;
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    description: string;
    enabled: boolean;
}

export function Settings() {
    const { theme, setTheme } = useTheme();
    const [language, setLanguage] = useState("zh-CN");
    const [autoStart, setAutoStart] = useState(false);
    const [cachePolicy, setCachePolicy] = useState("3days");
    const [maxCache, setMaxCache] = useState(512);

    const [notifications, setNotifications] = useState<NotificationSetting[]>([
        { id: "export", icon: <Download size={18} />, iconBg: "blue", title: "导出完成通知", description: "当日志文件导出准备就绪时通知我", enabled: true },
        { id: "disconnect", icon: <Link2Off size={18} />, iconBg: "red", title: "连接异常通知", description: "当服务器连接中断或超时时发出警告", enabled: true },
        { id: "desktop", icon: <Bell size={18} />, iconBg: "gray", title: "桌面通知", description: "使用系统原生通知气泡", enabled: true },
        { id: "sound", icon: <Volume2 size={18} />, iconBg: "gray", title: "声音提示", description: "收到重要通知时播放提示音", enabled: false },
    ]);

    const toggleNotification = (id: string) => {
        setNotifications(prev => prev.map(n =>
            n.id === id ? { ...n, enabled: !n.enabled } : n
        ));
    };

    // Track if initial load is complete to prevent saving on mount
    const [isLoaded, setIsLoaded] = useState(false);

    // Load settings from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (stored) {
                const settings = JSON.parse(stored);
                if (settings.cachePolicy) setCachePolicy(settings.cachePolicy);
                if (settings.maxCache !== undefined) setMaxCache(settings.maxCache);
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
        // Mark as loaded after initial load
        setIsLoaded(true);
    }, []);

    // Save settings to localStorage when they change (only after initial load)
    useEffect(() => {
        if (!isLoaded) return; // Don't save during initial load
        const settings = { cachePolicy, maxCache };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }, [cachePolicy, maxCache, isLoaded]);

    // State for cache cleared - persists until page reload
    const [cacheCleared, setCacheCleared] = useState(false);
    // State for showing the success badge animation (temporary)
    const [showClearedBadge, setShowClearedBadge] = useState(false);

    // Clear local cache (search history) - using async Tauri dialog
    const handleClearCache = async () => {
        console.log('handleClearCache called');
        const { ask } = await import('@tauri-apps/plugin-dialog');
        const confirmed = await ask('确定要清空所有本地缓存吗？这将删除搜索历史等数据。', {
            title: '清空本地缓存',
            kind: 'warning'
        });

        console.log('User confirmed:', confirmed);
        if (confirmed) {
            localStorage.removeItem('log_search_history');
            console.log('Setting cacheCleared to true');
            setCacheCleared(true);  // Permanent until page reload
            setShowClearedBadge(true);  // Temporary badge
            // Only hide the badge after 3 seconds, keep showing 0 MB
            setTimeout(() => setShowClearedBadge(false), 3000);
        }
    };

    return (
        <div className="settings-page">
            {/* Header */}
            <header className="page-header">
                <div className="page-title">
                    <h2>系统设置</h2>
                    <p>配置工具的通用参数与偏好</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary">
                        <Save size={16} />
                        <span>保存更改</span>
                    </button>
                </div>
            </header>

            {/* Body */}
            <div className="content-body">
                <div className="settings-container">

                    {/* General Settings */}
                    <section className="settings-section">
                        <h3 className="section-title">通用设置</h3>
                        <div className="settings-card">
                            <div className="settings-grid">
                                {/* Language */}
                                <div className="form-field">
                                    <label>界面语言</label>
                                    <select value={language} onChange={e => setLanguage(e.target.value)}>
                                        <option value="zh-CN">简体中文 (Chinese Simplified)</option>
                                        <option value="en-US">English (US)</option>
                                    </select>
                                    <p className="field-hint">更改语言后需要重启应用生效。</p>
                                </div>

                                {/* Auto Start */}
                                <div className="form-field">
                                    <label>启动设置</label>
                                    <div className="toggle-card">
                                        <div className="toggle-info">
                                            <span className="toggle-title">开机自启动</span>
                                            <span className="toggle-desc">登录系统时自动运行</span>
                                        </div>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={autoStart}
                                                onChange={() => setAutoStart(!autoStart)}
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>

                                {/* Theme */}
                                <div className="form-field full-width">
                                    <label>外观主题</label>
                                    <div className="theme-grid">
                                        <label className={`theme-option ${theme === 'light' ? 'selected' : ''}`}>
                                            <input
                                                type="radio"
                                                name="theme"
                                                value="light"
                                                checked={theme === 'light'}
                                                onChange={() => setTheme('light')}
                                            />
                                            <div className="theme-preview light">
                                                <div className="theme-header">
                                                    <Sun size={18} />
                                                    <span>浅色模式</span>
                                                </div>
                                                <div className="theme-lines">
                                                    <div className="line w-75"></div>
                                                    <div className="line w-50"></div>
                                                </div>
                                            </div>
                                        </label>

                                        <label className={`theme-option ${theme === 'dark' ? 'selected' : ''}`}>
                                            <input
                                                type="radio"
                                                name="theme"
                                                value="dark"
                                                checked={theme === 'dark'}
                                                onChange={() => setTheme('dark')}
                                            />
                                            <div className="theme-preview dark">
                                                <div className="theme-header">
                                                    <Moon size={18} />
                                                    <span>深色模式</span>
                                                </div>
                                                <div className="theme-lines">
                                                    <div className="line w-75"></div>
                                                    <div className="line w-50"></div>
                                                </div>
                                            </div>
                                        </label>

                                        <label className={`theme-option ${theme === 'system' ? 'selected' : ''}`}>
                                            <input
                                                type="radio"
                                                name="theme"
                                                value="system"
                                                checked={theme === 'system'}
                                                onChange={() => setTheme('system')}
                                            />
                                            <div className="theme-preview system">
                                                <div className="theme-header">
                                                    <Monitor size={18} />
                                                    <span>跟随系统</span>
                                                </div>
                                                <div className="theme-lines">
                                                    <div className="line w-75"></div>
                                                    <div className="line w-50"></div>
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Notification Settings */}
                    <section className="settings-section">
                        <h3 className="section-title">通知设置</h3>
                        <div className="settings-card no-padding">
                            {notifications.map(notif => (
                                <div key={notif.id} className="notification-row">
                                    <div className="notification-left">
                                        <div className={`notification-icon ${notif.iconBg}`}>
                                            {notif.icon}
                                        </div>
                                        <div className="notification-text">
                                            <h4>{notif.title}</h4>
                                            <p>{notif.description}</p>
                                        </div>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={notif.enabled}
                                            onChange={() => toggleNotification(notif.id)}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Data Management */}
                    <section className="settings-section">
                        <h3 className="section-title">数据管理</h3>
                        <div className="settings-card">
                            <div className="settings-grid">
                                <div className="form-field">
                                    <label>搜索结果缓存策略</label>
                                    <select value={cachePolicy} onChange={e => setCachePolicy(e.target.value)}>
                                        <option value="24h">保留 24 小时</option>
                                        <option value="3days">保留 3 天</option>
                                        <option value="1week">保留 1 周</option>
                                        <option value="none">不缓存 (仅本次会话)</option>
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>最大缓存占用</label>
                                    <div className="input-with-suffix">
                                        <input
                                            type="number"
                                            value={maxCache}
                                            onChange={e => setMaxCache(Number(e.target.value))}
                                        />
                                        <span className="input-suffix">MB</span>
                                    </div>
                                </div>
                            </div>
                            <div className="cache-footer">
                                <div className="cache-info">
                                    <div className="cache-label">当前缓存占用</div>
                                    <div className={`cache-value ${cacheCleared ? 'cleared' : ''}`}>
                                        {cacheCleared ? '0 MB' : '128.5 MB'} / {maxCache} MB
                                        {showClearedBadge && <span className="cache-cleared-badge">✓ 已清空</span>}
                                    </div>
                                </div>
                                <button className="btn btn-danger-outline" onClick={handleClearCache}>
                                    <Trash2 size={16} />
                                    <span>清空本地缓存</span>
                                </button>
                            </div>
                        </div>
                    </section>



                    {/* About */}
                    <section className="settings-section">
                        <div className="about-card">
                            <div className="about-icon">
                                <Terminal size={32} />
                            </div>
                            <div className="about-content">
                                <h3>LogTool Pro</h3>
                                <p className="version">版本 1.0.2 (Build 20251224)</p>
                                <p className="description">
                                    LogTool Pro 是一款专为开发和测试人员设计的轻量级日志检索工具。支持多服务器并发查询、实时流式传输和高级过滤功能。
                                </p>
                                <div className="about-links">
                                    <a href="#">用户协议</a>
                                    <span className="divider">|</span>
                                    <a href="#">隐私政策</a>
                                    <span className="divider">|</span>
                                    <a href="#">检查更新</a>
                                </div>
                                <div className="copyright">
                                    © 2025 LogTool designed by Taylor Zhu. All rights reserved. MIT License.
                                </div>
                            </div>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
}
