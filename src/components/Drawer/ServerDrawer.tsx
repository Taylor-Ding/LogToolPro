import { X, RefreshCw, Loader2, Info, CheckCircle, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./ServerDrawer.css";

interface ServerConfig {
    id: string;
    host: string;
    port: number;
    username: string;
    password: string;
    description: string;
    environment: string;
    status: string;
}

interface ServerDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (server: ServerConfig) => void;
    editServer?: ServerConfig | null;
}

interface TestResult {
    success: boolean;
    message: string;
}

export function ServerDrawer({ isOpen, onClose, onSuccess, editServer }: ServerDrawerProps) {
    const [host, setHost] = useState("");
    const [port, setPort] = useState(22);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [description, setDescription] = useState("");
    const [environment, setEnvironment] = useState("Production");

    const [isTesting, setIsTesting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [testResult, setTestResult] = useState<TestResult | null>(null);

    const isEditMode = !!editServer;

    // Pre-fill form when editing
    useEffect(() => {
        if (editServer) {
            setHost(editServer.host);
            setPort(editServer.port);
            setUsername(editServer.username);
            setPassword(editServer.password);
            setDescription(editServer.description);
            setEnvironment(editServer.environment || "Production");
        } else {
            resetForm();
        }
    }, [editServer, isOpen]);

    const resetForm = () => {
        setHost("");
        setPort(22);
        setUsername("");
        setPassword("");
        setDescription("");
        setEnvironment("");
        setTestResult(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleTest = async () => {
        if (!host || !username || !password) {
            setTestResult({ success: false, message: "Please fill in all required fields" });
            return;
        }

        setIsTesting(true);
        setTestResult(null);

        const startTime = Date.now();

        try {
            const result = await invoke<string>("test_ssh_connection", {
                host,
                port,
                username,
                password,
            });

            // Ensure animation plays for at least 600ms
            const elapsed = Date.now() - startTime;
            if (elapsed < 600) {
                await new Promise(resolve => setTimeout(resolve, 600 - elapsed));
            }

            setTestResult({ success: true, message: result });
        } catch (error) {
            // Ensure animation plays for at least 600ms even on error
            const elapsed = Date.now() - startTime;
            if (elapsed < 600) {
                await new Promise(resolve => setTimeout(resolve, 600 - elapsed));
            }

            setTestResult({ success: false, message: String(error) });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = async () => {
        if (!host || !username || !password) {
            setTestResult({ success: false, message: "Please fill in all required fields" });
            return;
        }

        setIsSaving(true);

        const serverConfig: ServerConfig = {
            id: editServer?.id || crypto.randomUUID(),
            host,
            port,
            username,
            password,
            description,
            environment,
            status: editServer?.status || "unknown",
        };

        try {
            await invoke("save_server", { server: serverConfig });
            setTestResult({ success: true, message: isEditMode ? "Server updated!" : "Server saved!" });
            setTimeout(() => {
                handleClose();
                onSuccess?.(serverConfig);
            }, 600);
        } catch (error) {
            setTestResult({ success: false, message: String(error) });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={`drawer-overlay ${isOpen ? "open" : ""}`} onClick={handleClose}>
            <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
                <div className="drawer-header">
                    <h3 className="drawer-title">
                        {isEditMode ? "Edit Server Connection" : "New Server Connection"}
                    </h3>
                    <button className="close-btn" onClick={handleClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="drawer-body">
                    <div className="form-group">
                        <label className="form-label">Server Address (IP) <span className="required">*</span></label>
                        <div className="form-input-wrapper">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. 192.168.1.100"
                                value={host}
                                onChange={(e) => setHost(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Port</label>
                            <div className="form-input-wrapper">
                                <input
                                    type="number"
                                    className="form-input"
                                    value={port}
                                    onChange={(e) => setPort(Number(e.target.value))}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Username <span className="required">*</span></label>
                            <div className="form-input-wrapper">
                                <input
                                    type="text"
                                    className="form-input"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password <span className="required">*</span></label>
                        <div className="form-input-wrapper">
                            <input
                                type="password"
                                className="form-input"
                                placeholder={isEditMode ? "(unchanged)" : "••••••••"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                        </div>
                        <p className="form-hint">SSH Key authentication is recommended for security.</p>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Environment</label>
                            <div className="form-input-wrapper">
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. T1"
                                    value={environment}
                                    onChange={(e) => setEnvironment(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <div className="form-input-wrapper">
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Gateway"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Test Result Display */}
                    {testResult && (
                        <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                            {testResult.success ? (
                                <CheckCircle size={18} />
                            ) : (
                                <XCircle size={18} />
                            )}
                            <span>{testResult.message}</span>
                        </div>
                    )}

                    <div className="info-box">
                        <Info size={18} className="info-icon" />
                        <p className="info-text">
                            保存后系统将立即尝试验证连接。请确保您的 IP 允许来自此机器的入站连接。
                        </p>
                    </div>
                </div>

                <div className="drawer-footer">
                    <button
                        className="btn btn-primary btn-block"
                        onClick={handleSave}
                        disabled={isSaving || isTesting}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={18} className="spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            isEditMode ? "Update Connection" : "Save Connection"
                        )}
                    </button>
                    <div className="footer-actions">
                        <button className="btn btn-secondary" onClick={handleClose}>
                            Cancel
                        </button>
                        <button
                            className="btn btn-secondary"
                            style={{ color: 'var(--color-primary)', borderColor: 'rgba(208,187,149,0.3)' }}
                            onClick={handleTest}
                            disabled={isTesting || isSaving}
                        >
                            {isTesting ? (
                                <>
                                    <Loader2 size={16} className="spin" />
                                    <span>Testing...</span>
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={16} />
                                    <span>Test</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
