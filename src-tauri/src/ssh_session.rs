use dashmap::DashMap;
use lazy_static::lazy_static;
use serde::Serialize;
use ssh2::{Channel, Session};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Clone, Serialize)]
pub struct SshOutput {
    pub session_id: String,
    pub data: String,
}

#[derive(Clone, Serialize)]
pub struct SshExit {
    pub session_id: String,
}

pub struct SshSession {
    #[allow(dead_code)]
    pub id: String,
    pub channel: Channel,
    #[allow(dead_code)]
    pub session: Session,
    #[allow(dead_code)]
    tcp: TcpStream,
    shutdown: Arc<AtomicBool>,
}

impl SshSession {
    pub fn write(&mut self, data: &[u8]) -> Result<usize, String> {
        self.channel.write(data).map_err(|e| e.to_string())
    }

    pub fn resize(&mut self, cols: u32, rows: u32) -> Result<(), String> {
        self.channel
            .request_pty_size(cols, rows, None, None)
            .map_err(|e| e.to_string())
    }

    pub fn close(&mut self) {
        self.shutdown.store(true, Ordering::SeqCst);
        let _ = self.channel.send_eof();
        let _ = self.channel.wait_close();
    }
}

lazy_static! {
    pub static ref SESSION_MANAGER: SessionManager = SessionManager::new();
}

pub struct SessionManager {
    sessions: DashMap<String, Arc<std::sync::Mutex<SshSession>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: DashMap::new(),
        }
    }

    pub fn start_session(
        &self,
        app_handle: AppHandle,
        host: String,
        port: u16,
        username: String,
        password: String,
        cols: u32,
        rows: u32,
    ) -> Result<String, String> {
        let session_id = Uuid::new_v4().to_string();
        let addr = format!("{}:{}", host, port);

        // Connect TCP
        let tcp = TcpStream::connect(&addr)
            .map_err(|e| format!("TCP connection failed: {}", e))?;

        tcp.set_nonblocking(false)
            .map_err(|e| format!("Failed to set blocking: {}", e))?;

        // Create SSH session
        let mut sess = Session::new()
            .map_err(|e| format!("Failed to create session: {}", e))?;

        sess.set_tcp_stream(tcp.try_clone().map_err(|e| e.to_string())?);
        sess.handshake()
            .map_err(|e| format!("SSH handshake failed: {}", e))?;

        // Authenticate
        sess.userauth_password(&username, &password)
            .map_err(|e| format!("Authentication failed: {}", e))?;

        if !sess.authenticated() {
            return Err("Authentication failed".to_string());
        }

        // Open channel and request PTY
        let mut channel = sess
            .channel_session()
            .map_err(|e| format!("Failed to open channel: {}", e))?;

        channel
            .request_pty("xterm-256color", None, Some((cols, rows, 0, 0)))
            .map_err(|e| format!("Failed to request PTY: {}", e))?;

        channel
            .shell()
            .map_err(|e| format!("Failed to start shell: {}", e))?;

        // Set channel to non-blocking for reading
        sess.set_blocking(false);

        let shutdown = Arc::new(AtomicBool::new(false));
        let shutdown_clone = shutdown.clone();
        let session_id_clone = session_id.clone();

        // Create session object
        let ssh_session = SshSession {
            id: session_id.clone(),
            channel,
            session: sess,
            tcp,
            shutdown,
        };

        let session_arc = Arc::new(std::sync::Mutex::new(ssh_session));
        self.sessions.insert(session_id.clone(), session_arc.clone());

        // Spawn reader thread
        thread::spawn(move || {
            let mut buffer = [0u8; 4096];
            
            loop {
                if shutdown_clone.load(Ordering::SeqCst) {
                    break;
                }

                // Try to read from channel
                let bytes_read = {
                    let mut session = match session_arc.lock() {
                        Ok(s) => s,
                        Err(_) => break,
                    };
                    
                    match session.channel.read(&mut buffer) {
                        Ok(0) => {
                            // EOF - send exit event
                            let _ = app_handle.emit(
                                "ssh-exit",
                                SshExit {
                                    session_id: session_id_clone.clone(),
                                },
                            );
                            break;
                        }
                        Ok(n) => n,
                        Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                            // No data available, sleep briefly
                            drop(session);
                            thread::sleep(Duration::from_millis(10));
                            continue;
                        }
                        Err(_) => {
                            break;
                        }
                    }
                };

                if bytes_read > 0 {
                    // Convert to string (lossy for binary data)
                    let data = String::from_utf8_lossy(&buffer[..bytes_read]).to_string();
                    
                    // Emit to frontend
                    let _ = app_handle.emit(
                        "ssh-output",
                        SshOutput {
                            session_id: session_id_clone.clone(),
                            data,
                        },
                    );
                }
            }
        });

        Ok(session_id)
    }

    pub fn send_input(&self, session_id: &str, data: &str) -> Result<(), String> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or("Session not found")?;

        let mut session = session.lock().map_err(|_| "Lock failed")?;
        session.write(data.as_bytes())?;
        Ok(())
    }

    pub fn resize(&self, session_id: &str, cols: u32, rows: u32) -> Result<(), String> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or("Session not found")?;

        let mut session = session.lock().map_err(|_| "Lock failed")?;
        session.resize(cols, rows)
    }

    pub fn close_session(&self, session_id: &str) -> Result<(), String> {
        if let Some((_, session)) = self.sessions.remove(session_id) {
            if let Ok(mut s) = session.lock() {
                s.close();
            }
        }
        Ok(())
    }
}
