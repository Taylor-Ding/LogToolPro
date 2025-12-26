// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod ssh_session;
mod crypto;

use serde::{Deserialize, Serialize};
use ssh2::Session;
use ssh_session::SESSION_MANAGER;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use sysinfo::System;
use tauri::Manager;

#[derive(Serialize)]
pub struct SystemInfo {
    cpu_usage: f32,
    memory_used_gb: f64,
    memory_total_gb: f64,
    memory_usage_percent: f32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ServerConfig {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub description: String,
    #[serde(default)]
    pub environment: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, Default)]
struct ServerStore {
    servers: Vec<ServerConfig>,
}

fn get_servers_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    Ok(app_dir.join("servers.json"))
}

fn load_servers(app_handle: &tauri::AppHandle) -> Result<ServerStore, String> {
    let path = get_servers_file_path(app_handle)?;
    if !path.exists() {
        return Ok(ServerStore::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

fn save_servers(app_handle: &tauri::AppHandle, store: &ServerStore) -> Result<(), String> {
    let path = get_servers_file_path(app_handle)?;
    let content = serde_json::to_string_pretty(store).map_err(|e| e.to_string())?;
    let mut file = fs::File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn test_ssh_connection(host: String, port: u16, username: String, password: String) -> Result<String, String> {
    // Run the blocking SSH operations in a separate thread
    tokio::task::spawn_blocking(move || {
        let addr = format!("{}:{}", host, port);
        
        // Connect TCP
        let tcp = TcpStream::connect(&addr)
            .map_err(|e| format!("TCP connection failed: {}", e))?;
        
        tcp.set_read_timeout(Some(std::time::Duration::from_secs(10)))
            .map_err(|e| format!("Failed to set timeout: {}", e))?;
        
        // Create SSH session
        let mut sess = Session::new()
            .map_err(|e| format!("Failed to create SSH session: {}", e))?;
        
        sess.set_tcp_stream(tcp);
        sess.handshake()
            .map_err(|e| format!("SSH handshake failed: {}", e))?;
        
        // Authenticate with password
        sess.userauth_password(&username, &password)
            .map_err(|e| format!("Authentication failed: {}", e))?;
        
        if sess.authenticated() {
            // Try to execute a simple command
            let mut channel = sess.channel_session()
                .map_err(|e| format!("Failed to open channel: {}", e))?;
            channel.exec("echo 'Connection test successful'")
                .map_err(|e| format!("Failed to execute command: {}", e))?;
            
            let mut output = String::new();
            channel.read_to_string(&mut output)
                .map_err(|e| format!("Failed to read output: {}", e))?;
            channel.wait_close().ok();
            
            Ok(format!("✓ Successfully connected to {} as {}", host, username))
        } else {
            Err("Authentication failed".to_string())
        }
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
fn save_server(app_handle: tauri::AppHandle, server: ServerConfig) -> Result<ServerConfig, String> {
    let mut store = load_servers(&app_handle)?;
    
    // Encrypt the password before storing
    let encrypted_password = crypto::encrypt_password(&server.password)?;
    let mut server_to_store = server.clone();
    server_to_store.password = encrypted_password;
    
    // Check if server with same ID exists (update) or add new
    if let Some(pos) = store.servers.iter().position(|s| s.id == server_to_store.id) {
        store.servers[pos] = server_to_store;
    } else {
        store.servers.push(server_to_store);
    }
    
    save_servers(&app_handle, &store)?;
    // Return the original server with plaintext password to frontend
    Ok(server)
}

#[tauri::command]
fn list_servers(app_handle: tauri::AppHandle) -> Result<Vec<ServerConfig>, String> {
    let store = load_servers(&app_handle)?;
    // Decrypt passwords before returning to frontend
    // If decryption fails (e.g., legacy plaintext password), use the original value
    let decrypted_servers: Vec<ServerConfig> = store
        .servers
        .into_iter()
        .map(|mut s| {
            s.password = crypto::decrypt_password(&s.password).unwrap_or_else(|_| s.password.clone());
            s
        })
        .collect();
    Ok(decrypted_servers)
}

/// List servers for export - keeps passwords encrypted
#[tauri::command]
fn list_servers_for_export(app_handle: tauri::AppHandle) -> Result<Vec<ServerConfig>, String> {
    let store = load_servers(&app_handle)?;
    // Return servers with encrypted passwords as stored
    Ok(store.servers)
}

#[tauri::command]
fn delete_server(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut store = load_servers(&app_handle)?;
    store.servers.retain(|s| s.id != id);
    save_servers(&app_handle, &store)?;
    Ok(())
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    // CPU usage (average across all cores)
    let cpu_usage = sys.global_cpu_usage();
    
    // Memory info (in bytes, convert to GB)
    let memory_used = sys.used_memory() as f64 / 1_073_741_824.0; // bytes to GB
    let memory_total = sys.total_memory() as f64 / 1_073_741_824.0;
    let memory_percent = if memory_total > 0.0 {
        (memory_used / memory_total * 100.0) as f32
    } else {
        0.0
    };
    
    SystemInfo {
        cpu_usage,
        memory_used_gb: memory_used,
        memory_total_gb: memory_total,
        memory_usage_percent: memory_percent,
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn execute_ssh_command(
    host: String,
    port: u16,
    username: String,
    password: String,
    command: String,
) -> Result<String, String> {
    let addr = format!("{}:{}", host, port);
    
    let tcp = TcpStream::connect(&addr)
        .map_err(|e| format!("Connection failed: {}", e))?;
    
    tcp.set_read_timeout(Some(std::time::Duration::from_secs(30)))
        .map_err(|e| format!("Failed to set timeout: {}", e))?;
    
    let mut sess = Session::new()
        .map_err(|e| format!("Session failed: {}", e))?;
    
    sess.set_tcp_stream(tcp);
    sess.handshake()
        .map_err(|e| format!("Handshake failed: {}", e))?;
    
    sess.userauth_password(&username, &password)
        .map_err(|e| format!("Auth failed: {}", e))?;
    
    if !sess.authenticated() {
        return Err("Authentication failed".to_string());
    }
    
    let mut channel = sess.channel_session()
        .map_err(|e| format!("Channel failed: {}", e))?;
    
    channel.exec(&command)
        .map_err(|e| format!("Exec failed: {}", e))?;
    
    let mut stdout = String::new();
    channel.read_to_string(&mut stdout)
        .map_err(|e| format!("Read failed: {}", e))?;
    
    let mut stderr = String::new();
    channel.stderr().read_to_string(&mut stderr).ok();
    
    channel.wait_close().ok();
    let exit_status = channel.exit_status().unwrap_or(-1);
    
    if !stderr.is_empty() && exit_status != 0 {
        Ok(format!("{}\n[stderr] {}\n[exit: {}]", stdout, stderr, exit_status))
    } else {
        Ok(stdout)
    }
}

// PTY Session Commands
#[tauri::command]
fn start_pty_session(
    app_handle: tauri::AppHandle,
    host: String,
    port: u16,
    username: String,
    password: String,
    cols: u32,
    rows: u32,
) -> Result<String, String> {
    SESSION_MANAGER.start_session(app_handle, host, port, username, password, cols, rows)
}

#[tauri::command]
fn send_pty_input(session_id: String, data: String) -> Result<(), String> {
    SESSION_MANAGER.send_input(&session_id, &data)
}

#[tauri::command]
fn resize_pty(session_id: String, cols: u32, rows: u32) -> Result<(), String> {
    SESSION_MANAGER.resize(&session_id, cols, rows)
}

#[tauri::command]
fn close_pty_session(session_id: String) -> Result<(), String> {
    SESSION_MANAGER.close_session(&session_id)
}

// Chain node for server-based transaction chain tracing
#[derive(Serialize, Clone, Debug)]
pub struct ChainNode {
    pub filename: String,      // Log file name (e.g., comm-InboundGatewayService-1022199.log)
    pub dus_id: String,        // DESTDUS value (e.g., B001Y)
    pub ip: String,            // Node IP address
    pub log_path: String,      // Log directory path
    pub children: Vec<ChainNode>, // Child nodes in the chain
}

// Result of chain tracing operation
#[derive(Serialize)]
pub struct ChainTraceResult {
    pub nodes: Vec<ChainNode>,     // Chain node tree
    pub trace_log: Vec<String>,    // Trace progress logs
    pub total_hops: u32,           // Total number of hops traced
    pub duration_ms: u64,          // Total time taken
    pub error: Option<String>,     // Error message if any
}

// Helper function to execute SSH command and get output
fn execute_ssh_for_chain(
    host: &str,
    port: u16,
    username: &str,
    password: &str,
    command: &str,
) -> Result<String, String> {
    let addr = format!("{}:{}", host, port);
    
    let tcp = TcpStream::connect(&addr)
        .map_err(|e| format!("Connection to {} failed: {}", host, e))?;
    
    tcp.set_read_timeout(Some(std::time::Duration::from_secs(60)))
        .map_err(|e| format!("Failed to set timeout: {}", e))?;
    
    let mut sess = Session::new()
        .map_err(|e| format!("Session failed: {}", e))?;
    
    sess.set_tcp_stream(tcp);
    sess.handshake()
        .map_err(|e| format!("Handshake failed: {}", e))?;
    
    sess.userauth_password(username, password)
        .map_err(|e| format!("Auth failed on {}: {}", host, e))?;
    
    if !sess.authenticated() {
        return Err(format!("Authentication failed on {}", host));
    }
    
    let mut channel = sess.channel_session()
        .map_err(|e| format!("Channel failed: {}", e))?;
    
    channel.exec(command)
        .map_err(|e| format!("Exec failed: {}", e))?;
    
    let mut stdout = String::new();
    channel.read_to_string(&mut stdout)
        .map_err(|e| format!("Read failed: {}", e))?;
    
    channel.wait_close().ok();
    
    Ok(stdout)
}

// Parse chain search output line: "filename dus_id ip"
fn parse_chain_line(line: &str) -> Option<(String, String, String)> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() >= 3 {
        let filename = parts[0].trim_start_matches("./").to_string();
        let dus_id = parts[1].to_string();
        let ip = parts[2].to_string();
        Some((filename, dus_id, ip))
    } else {
        None
    }
}

// Check if DUS ID is a valid node (B or C prefix) vs router (G prefix)
fn is_valid_chain_node(dus_id: &str) -> bool {
    dus_id.starts_with('B') || dus_id.starts_with('C')
}

// Recursive chain tracing function
fn trace_chain_recursive(
    host: &str,
    port: u16,
    username: &str,
    password: &str,
    trace_id: &str,
    log_path: &str,
    trace_log: &mut Vec<String>,
    visited_ips: &mut std::collections::HashSet<String>,
    known_servers: &Vec<ServerConfig>,
    depth: u32,
    max_depth: u32,
) -> Result<Vec<ChainNode>, String> {
    if depth >= max_depth {
        trace_log.push(format!("[WARN] Max depth {} reached at {}", max_depth, host));
        return Ok(Vec::new());
    }
    
    if visited_ips.contains(host) {
        trace_log.push(format!("[SKIP] Already visited: {}", host));
        return Ok(Vec::new());
    }
    visited_ips.insert(host.to_string());
    
    trace_log.push(format!("[{}] Searching on {} ...", depth + 1, host));
    
    // Build the search command
    let command = format!(
        "cd {} && find . -maxdepth 1 -name \"*log*\" -print0 | xargs -0 -P $(nproc) grep -H -F '{}' 2>/dev/null | grep -F 'PEER' | sed -n 's/^\\([^:]*\\):.*DESTDUS=\\([^|]*\\).*PEER=\\([0-9.]*\\).*/\\1 \\2 \\3/p' | grep -v 'N/A' | sort -u",
        log_path, trace_id
    );
    
    let output = execute_ssh_for_chain(host, port, username, password, &command)?;
    
    let lines: Vec<&str> = output.lines().filter(|l| !l.is_empty()).collect();
    
    // Check if we need fallback (no results or only G-codes)
    let has_non_g = lines.iter().any(|l| parse_chain_line(l).map(|(_, id, _)| !id.starts_with('G')).unwrap_or(false));
    let mut fallback_nodes = Vec::new();

    if lines.is_empty() || !has_non_g {
        trace_log.push(format!("[{}] Checking backup app logs on {}...", depth + 1, host));
        // Use user-provided fallback command to find app logs containing the trace ID
        let fb_cmd = format!(
            "cd {} && find . -maxdepth 1 -name \"*app*log*\" -print0 | xargs -0 -P $(nproc) grep -H -F '{}' 2>/dev/null | awk -F: '/dusCode/ {{ filename = $1; sub(/^\\.\\//, \"\", filename); text = $0; sub(/.*dusCode : /, \"\", text); split(text, codes, \" \"); print filename, \" \", codes[1] }}'",
            log_path, trace_id
        );
        
        if let Ok(fb_out) = execute_ssh_for_chain(host, port, username, password, &fb_cmd) {
            for l in fb_out.lines().filter(|l| !l.is_empty()) {
                 let parts: Vec<&str> = l.split_whitespace().collect();
                 if parts.len() >= 2 {
                      let filename = parts[0].to_string();
                      let dus_id = parts[1].to_string();
                      
                      fallback_nodes.push(ChainNode {
                          filename: filename.clone(),
                          dus_id: dus_id.clone(),
                          ip: host.to_string(), // Keep current IP
                          log_path: log_path.to_string(),
                          children: Vec::new(),
                      });
                      trace_log.push(format!("  -> [Fallback] found {} {} on {}", filename, dus_id, host));
                 }
            }
        }
    }

    if lines.is_empty() && fallback_nodes.is_empty() {
        trace_log.push(format!("[{}] No results found on {}", depth + 1, host));
        return Ok(Vec::new());
    }
    
    trace_log.push(format!("[{}] Found {} entries on {}", depth + 1, lines.len(), host));
    
    let mut nodes: Vec<ChainNode> = Vec::new();
    
    for line in lines {
        if let Some((filename, dus_id, ip)) = parse_chain_line(line) {
            let is_valid = is_valid_chain_node(&dus_id);
            let node_type = if is_valid { "有效节点" } else { "路由节点" };
            trace_log.push(format!("  -> {} {} {} ({})", filename, dus_id, ip, node_type));
            
            // Recursively trace valid nodes (B/C prefix)
            let children = if is_valid && !visited_ips.contains(&ip) {
                // Validate next hop against known servers
                if let Some(next_server) = known_servers.iter().find(|s| s.host == ip) {
                    trace_chain_recursive(
                        &next_server.host,
                        next_server.port,
                        &next_server.username,
                        &next_server.password,
                        trace_id,
                        log_path,
                        trace_log,
                        visited_ips,
                        known_servers,
                        depth + 1,
                        max_depth,
                    ).unwrap_or_else(|e| {
                        trace_log.push(format!("[ERROR] Failed to trace {}: {}", ip, e));
                        Vec::new()
                    })
                } else {
                    trace_log.push(format!("[ERROR] 发现下一节点 IP {} 不在配置列表中。请先在服务器配置中添加该节点才能继续追踪。", ip));
                    Vec::new()
                }
            } else {
                Vec::new()
            };
            
            nodes.push(ChainNode {
                filename,
                dus_id,
                ip: host.to_string(),
                log_path: log_path.to_string(),
                children,
            });
        }
    }
    
    nodes.extend(fallback_nodes);
    
    Ok(nodes)
}

#[tauri::command]
async fn trace_server_chain(
    host: String,
    port: u16,
    username: String,
    password: String,
    trace_id: String,
    log_path: String,
    known_servers: Vec<ServerConfig>,
) -> Result<ChainTraceResult, String> {
    let start_time = std::time::Instant::now();
    
    let result = tokio::task::spawn_blocking(move || {
        let mut trace_log: Vec<String> = Vec::new();
        let mut visited_ips: std::collections::HashSet<String> = std::collections::HashSet::new();
        
        trace_log.push(format!("=== 开始追踪交易链路 ==="));
        trace_log.push(format!("流水号: {}", trace_id));
        trace_log.push(format!("起始服务器: {}", host));
        trace_log.push(format!("日志路径: {}", log_path));
        trace_log.push(String::new());
        
        let nodes = trace_chain_recursive(
            &host,
            port,
            &username,
            &password,
            &trace_id,
            &log_path,
            &mut trace_log,
            &mut visited_ips,
            &known_servers,
            0,
            10, // max depth
        )?;
        
        let total_hops = visited_ips.len() as u32;
        trace_log.push(String::new());
        trace_log.push(format!("=== 追踪完成: 共访问 {} 个节点 ===", total_hops));
        
        Ok::<(Vec<ChainNode>, Vec<String>, u32), String>((nodes, trace_log, total_hops))
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    
    let duration_ms = start_time.elapsed().as_millis() as u64;
    
    match result {
        Ok((nodes, trace_log, total_hops)) => Ok(ChainTraceResult {
            nodes,
            trace_log,
            total_hops,
            duration_ms,
            error: None,
        }),
        Err(e) => Ok(ChainTraceResult {
            nodes: Vec::new(),
            trace_log: vec![format!("Error: {}", e)],
            total_hops: 0,
            duration_ms,
            error: Some(e),
        }),
    }
}

// Log file info for search results
#[derive(Serialize, Clone)]
pub struct LogFileInfo {
    pub path: String,
    pub name: String,
    pub match_count: u32,
}

// Search result for a single server
#[derive(Serialize)]
pub struct LogSearchResult {
    pub server_id: String,
    pub host: String,
    pub files: Vec<LogFileInfo>,
    pub total_matches: u32,
    pub duration_ms: u64,
    pub error: Option<String>,
}

#[tauri::command]
async fn search_log_files(
    host: String,
    port: u16,
    username: String,
    password: String,
    server_id: String,
    log_path: String,
    trace_id: String,
) -> Result<LogSearchResult, String> {
    let start_time = std::time::Instant::now();
    let host_clone = host.clone();
    let server_id_clone = server_id.clone();
    
    let result = tokio::task::spawn_blocking(move || {
        let addr = format!("{}:{}", host, port);
        
        // Connect TCP
        let tcp = TcpStream::connect(&addr)
            .map_err(|e| format!("TCP connection failed: {}", e))?;
        
        tcp.set_read_timeout(Some(std::time::Duration::from_secs(30)))
            .map_err(|e| format!("Failed to set timeout: {}", e))?;
        
        // Create SSH session
        let mut sess = Session::new()
            .map_err(|e| format!("Failed to create SSH session: {}", e))?;
        
        sess.set_tcp_stream(tcp);
        sess.handshake()
            .map_err(|e| format!("SSH handshake failed: {}", e))?;
        
        sess.userauth_password(&username, &password)
            .map_err(|e| format!("Authentication failed: {}", e))?;
        
        if !sess.authenticated() {
            return Err("Authentication failed".to_string());
        }
        
        // Find all files containing "log" in the filename (non-recursive, only current directory)
        let find_cmd = format!(
            "find {} -maxdepth 1 -type f -name '*log*' 2>/dev/null | head -100",
            log_path
        );
        
        let mut channel = sess.channel_session()
            .map_err(|e| format!("Failed to open channel: {}", e))?;
        channel.exec(&find_cmd)
            .map_err(|e| format!("Failed to execute find command: {}", e))?;
        
        let mut find_output = String::new();
        channel.read_to_string(&mut find_output)
            .map_err(|e| format!("Failed to read find output: {}", e))?;
        channel.wait_close().ok();
        
        let files: Vec<String> = find_output
            .lines()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect();
        
        if files.is_empty() {
            return Ok((Vec::new(), 0u32));
        }
        
        // If trace_id is provided, grep for it in each file
        let mut file_infos: Vec<LogFileInfo> = Vec::new();
        let mut total_matches: u32 = 0;
        
        for file_path in files {
            let file_name = file_path
                .split('/')
                .last()
                .unwrap_or(&file_path)
                .to_string();
            
            let match_count = if !trace_id.is_empty() {
                // Count matches for trace_id
                let grep_cmd = format!(
                    "grep -c '{}' '{}' 2>/dev/null || echo 0",
                    trace_id, file_path
                );
                
                let mut grep_channel = sess.channel_session()
                    .map_err(|e| format!("Failed to open grep channel: {}", e))?;
                grep_channel.exec(&grep_cmd)
                    .map_err(|e| format!("Failed to execute grep: {}", e))?;
                
                let mut grep_output = String::new();
                grep_channel.read_to_string(&mut grep_output).ok();
                grep_channel.wait_close().ok();
                
                grep_output.trim().parse::<u32>().unwrap_or(0)
            } else {
                0
            };
            
            total_matches += match_count;
            
            file_infos.push(LogFileInfo {
                path: file_path,
                name: file_name,
                match_count,
            });
        }
        
        // Sort by match count (descending) if trace_id was provided
        if !trace_id.is_empty() {
            // Filter out files with 0 matches when trace_id is provided
            file_infos.retain(|f| f.match_count > 0);
            file_infos.sort_by(|a, b| b.match_count.cmp(&a.match_count));
        }
        
        Ok((file_infos, total_matches))
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    
    let duration_ms = start_time.elapsed().as_millis() as u64;
    
    match result {
        Ok((files, total_matches)) => Ok(LogSearchResult {
            server_id: server_id_clone,
            host: host_clone,
            files,
            total_matches,
            duration_ms,
            error: None,
        }),
        Err(e) => Ok(LogSearchResult {
            server_id: server_id_clone,
            host: host_clone,
            files: Vec::new(),
            total_matches: 0,
            duration_ms,
            error: Some(e),
        }),
    }
}

#[tauri::command]
async fn read_log_file(
    host: String,
    port: u16,
    username: String,
    password: String,
    file_path: String,
    _trace_id: String,
    max_lines: u32,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let addr = format!("{}:{}", host, port);
        
        let tcp = TcpStream::connect(&addr)
            .map_err(|e| format!("TCP connection failed: {}", e))?;
        
        tcp.set_read_timeout(Some(std::time::Duration::from_secs(30)))
            .map_err(|e| format!("Failed to set timeout: {}", e))?;
        
        let mut sess = Session::new()
            .map_err(|e| format!("Session failed: {}", e))?;
        
        sess.set_tcp_stream(tcp);
        sess.handshake()
            .map_err(|e| format!("Handshake failed: {}", e))?;
        
        sess.userauth_password(&username, &password)
            .map_err(|e| format!("Auth failed: {}", e))?;
        
        if !sess.authenticated() {
            return Err("Authentication failed".to_string());
        }
        
        // Always read the full file content (trace_id filtering is done on frontend for highlighting)
        // Use cat to read the file, limiting output to max_lines
        let cmd = format!(
            "head -{} '{}' 2>/dev/null",
            max_lines, file_path
        );
        
        let mut channel = sess.channel_session()
            .map_err(|e| format!("Channel failed: {}", e))?;
        
        channel.exec(&cmd)
            .map_err(|e| format!("Exec failed: {}", e))?;
        
        let mut output = String::new();
        channel.read_to_string(&mut output)
            .map_err(|e| format!("Read failed: {}", e))?;
        
        channel.wait_close().ok();
        
        Ok(output)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_system_info,
            test_ssh_connection,
            save_server,
            list_servers,
            list_servers_for_export,
            delete_server,
            execute_ssh_command,
            start_pty_session,
            send_pty_input,
            resize_pty,
            close_pty_session,
            search_log_files,
            read_log_file,
            write_file,
            trace_server_chain
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
