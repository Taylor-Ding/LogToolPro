import { useRef, useEffect, useState } from "react";
import { X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./TerminalModal.css";

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

interface TerminalModalProps {
    isOpen: boolean;
    onClose: () => void;
    server: ServerInfo | null;
}

interface SshOutput {
    session_id: string;
    data: string;
}

interface SshExit {
    session_id: string;
}

export function TerminalModal({ isOpen, onClose, server }: TerminalModalProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const terminalInstance = useRef<Terminal | null>(null);
    const fitAddon = useRef<FitAddon | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const unlistenRef = useRef<UnlistenFn | null>(null);

    // Keep ref in sync
    useEffect(() => {
        sessionIdRef.current = sessionId;
    }, [sessionId]);

    // Initialize terminal
    useEffect(() => {
        if (isOpen && terminalRef.current && !terminalInstance.current) {
            const term = new Terminal({
                cursorBlink: true,
                cursorStyle: "block",
                fontSize: 14,
                fontFamily: "'Menlo', 'Monaco', 'Consolas', monospace",
                theme: {
                    background: "#282a36",
                    foreground: "#f8f8f2",
                    cursor: "#f8f8f2",
                    cursorAccent: "#282a36",
                    selectionBackground: "#44475a",
                    black: "#21222c",
                    red: "#ff5555",
                    green: "#50fa7b",
                    yellow: "#f1fa8c",
                    blue: "#bd93f9",
                    magenta: "#ff79c6",
                    cyan: "#8be9fd",
                    white: "#f8f8f2",
                    brightBlack: "#6272a4",
                    brightRed: "#ff6e6e",
                    brightGreen: "#69ff94",
                    brightYellow: "#ffffa5",
                    brightBlue: "#d6acff",
                    brightMagenta: "#ff92df",
                    brightCyan: "#a4ffff",
                    brightWhite: "#ffffff",
                },
            });

            fitAddon.current = new FitAddon();
            term.loadAddon(fitAddon.current);
            term.open(terminalRef.current);

            // Delay fit to allow layout to settle
            setTimeout(() => {
                fitAddon.current?.fit();
            }, 100);

            terminalInstance.current = term;

            // Handle user input
            term.onData((data) => {
                if (sessionIdRef.current) {
                    invoke("send_pty_input", { sessionId: sessionIdRef.current, data }).catch(console.error);
                }
            });

            // Handle resize
            term.onResize(({ cols, rows }) => {
                if (sessionIdRef.current) {
                    invoke("resize_pty", { sessionId: sessionIdRef.current, cols, rows }).catch(console.error);
                }
            });

            // Window resize listener
            const handleResize = () => {
                if (fitAddon.current) {
                    fitAddon.current.fit();
                }
            };
            window.addEventListener("resize", handleResize);

            return () => {
                window.removeEventListener("resize", handleResize);
            };
        }
    }, [isOpen, sessionId]);

    // Start session when modal opens
    useEffect(() => {
        if (isOpen && server && !sessionId && !isConnecting) {
            startSession();
        }
    }, [isOpen, server]);

    // Listen for SSH output
    useEffect(() => {
        if (sessionId) {
            const setupListener = async () => {
                const unlistenOutput = await listen<SshOutput>("ssh-output", (event) => {
                    if (event.payload.session_id === sessionId && terminalInstance.current) {
                        terminalInstance.current.write(event.payload.data);
                    }
                });

                const unlistenExit = await listen<SshExit>("ssh-exit", (event) => {
                    if (event.payload.session_id === sessionId) {
                        cleanup();
                        onClose();
                    }
                });

                unlistenRef.current = () => {
                    unlistenOutput();
                    unlistenExit();
                };
            };
            setupListener();

            return () => {
                if (unlistenRef.current) {
                    unlistenRef.current();
                }
            };
        }
    }, [sessionId]);

    // Cleanup on close
    useEffect(() => {
        if (!isOpen) {
            cleanup();
        }
    }, [isOpen]);

    const startSession = async () => {
        if (!server) return;

        setIsConnecting(true);
        setError(null);

        try {
            const cols = terminalInstance.current?.cols || 80;
            const rows = terminalInstance.current?.rows || 24;

            const newSessionId = await invoke<string>("start_pty_session", {
                host: server.host,
                port: server.port,
                username: server.username,
                password: server.password,
                cols,
                rows,
            });

            setSessionId(newSessionId);

            // Sync PTY size immediately after connection
            if (terminalInstance.current) {
                const { cols, rows } = terminalInstance.current;
                await invoke("resize_pty", { sessionId: newSessionId, cols, rows });
                terminalInstance.current.focus();
            }
        } catch (err) {
            setError(String(err));
            terminalInstance.current?.writeln(`\r\n\x1b[31mConnection failed: ${err}\x1b[0m`);
        } finally {
            setIsConnecting(false);
        }
    };

    const cleanup = async () => {
        if (sessionId) {
            try {
                await invoke("close_pty_session", { sessionId });
            } catch (e) {
                console.error("Failed to close session:", e);
            }
        }

        if (unlistenRef.current) {
            unlistenRef.current();
            unlistenRef.current = null;
        }

        if (terminalInstance.current) {
            terminalInstance.current.dispose();
            terminalInstance.current = null;
        }

        fitAddon.current = null;
        setSessionId(null);
        setError(null);
    };

    const handleClose = () => {
        cleanup();
        onClose();
    };

    if (!isOpen || !server) return null;

    return (
        <div className="terminal-overlay" onClick={handleClose}>
            <div className="terminal-modal" onClick={(e) => e.stopPropagation()}>
                {/* macOS-style window controls */}
                <div className="terminal-header">
                    <div className="window-controls">
                        <button className="window-btn close" onClick={handleClose} title="Close">
                            <X size={8} />
                        </button>
                        <button className="window-btn minimize" title="Minimize"></button>
                        <button className="window-btn maximize" title="Maximize"></button>
                    </div>
                    <span className="terminal-title-text">
                        {isConnecting ? "Connecting..." : `${server.username}@${server.host}`}
                    </span>
                </div>

                <div className="terminal-body" ref={terminalRef}>
                    {isConnecting && (
                        <div className="terminal-connecting">
                            Connecting to {server.host}...
                        </div>
                    )}
                </div>

                {error && (
                    <div className="terminal-error">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
