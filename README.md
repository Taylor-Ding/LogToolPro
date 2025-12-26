# LogToolPro

> 基于 Tauri + React + Rust 构建的高性能日志管理与服务器链路追踪工具。

## 项目简介 (Introduction)

LogToolPro 是一款现代化的桌面端应用，旨在为开发人员和运维工程师提供高效的日志检索和服务器管理体验。它结合了 Web 前端的灵活性与 Rust 后端的系统级性能，确保在处理大量数据和并发连接时的稳定与流畅。

## 系统架构 (Architecture)

本项目采用**前后端分离**的混合架构：

### 前端 (Frontend)
- **核心框架**: [React](https://react.dev/)
- **构建工具**: [Vite](https://vitejs.dev/) - 提供极速的开发服务器和打包体验。
- **语言**: [TypeScript](https://www.typescriptlang.org/) - 保证代码的类型安全和可维护性。
- **UI 设计**: 采用现代化的组件设计，追求极致的视觉美学与交互体验。
- **状态管理**: React Hooks。

### 后端 (Backend)
- **运行时**: [Tauri v2](https://tauri.app/) - 构建体积小、安全性高、内存占用低的桌面应用。
- **核心语言**: [Rust](https://www.rust-lang.org/)
- **关键依赖**:
  - `ssh2`: 用于安全可靠的 SSH 服务器连接与命令执行。
  - `sysinfo`: 获取本机系统状态信息的监控。
  - `tokio`: 强大的异步运行时，处理高并发 I/O 操作。
  - `dashmap`: 高性能的并发哈希映射，用于跨线程数据共享。

## 核心功能 (Key Features)

### 1. 多服务器日志检索 (Log Search)
- 支持同时连接多台服务器。
- 实时执行日志查询命令（如 `grep`）。
- 结果高亮显示与快速定位，支持上下文查看。

### 2. 服务器链路追踪 (Server Chain Trace)
- 可视化服务器之间的跳转链路。
- 自动探测与验证 SSH 连接路径。
- 支持复杂的跳板机（Bastion Host）场景递归追踪。

### 3. 配置管理 (Configuration Management)
- 安全存储服务器连接信息（IP、端口、认证凭证）。
- 支持服务器配置的灵活导入与导出。

### 4. 终端集成 (Terminal)
- 内置 `xterm.js`，提供完整的 SSH 终端操作体验。
- 无需离开应用即可在选定服务器上通过 Websocket 执行任意系统命令。

## 目录结构 (Directory Structure)

```
.
├── src/                # 前端源代码 (React)
│   ├── pages/          # 页面组件 (LogSearch, ServerConfig, etc.)
│   ├── config/         # 全局配置
│   └── ...
├── src-tauri/          # 后端源代码 (Rust)
│   ├── src/            # Rust 核心逻辑 (lib.rs, ssh_session.rs, etc.)
│   ├── Cargo.toml      # Rust 依赖配置
│   └── tauri.conf.json # Tauri 应用配置
├── public/             # 静态资源
└── package.json        # 前端依赖配置
```

## 开发指南 (Development)

### 环境要求
- **Node.js**: v18+
- **Rust**: 最新稳定版 (建议通过 `rustup` 安装)
- **包管理器**: npm 或 pnpm

### 启动开发环境

```bash
# 1. 安装前端依赖
npm install

# 2. 启动开发服务器 (同时启动 Frontend 和 Tauri Backend)
npm run tauri dev
```

### 构建生产版本

```bash
npm run tauri build
```

## 多平台构建与发布指南 (Build & Release)

### 1. 自动化构建 (GitHub Actions) - 推荐

本项目已配置 GitHub Actions 自动工作流，支持多平台自动打包与发布。

- **支持平台**:
  - Windows (x64, arm64)
  - macOS (Apple Silicon, Intel) - *注: Intel 构建依赖 macOS 13 runner*
  - Linux (x64/Debian-based)

- **触发方式**:
  推送一个以 `v` 开头的 Tag 即可触发自动构建发布流程。
  ```bash
  git tag v0.1.0
  git push origin v0.1.0
  ```
  构建完成后，Release 页会自动生成对应平台的安装包。

### 2. 本地手动构建 (Local Build)

若需在本地手动构建特定平台的安装包，请确保环境满足以下要求：

#### macOS (Apple Silicon & Intel)
无需额外配置，直接运行：
```bash
npm run tauri build
```
打包输出路径: `src-tauri/target/release/bundle/`

#### Windows
- **环境**: Windows 10/11
- **依赖**: 
  - [Microsoft Visual Studio C++ 构建工具](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  - [Webview2](https://developer.microsoft.com/microsoft-edge/webview2/) (通常已内置)
- **命令**:
```powershell
npm run tauri build
```
*注: Windows 上生成的 `.msi` 安装包依赖 WiX Toolset (v3)，Tauri CLI 会尝试自动安装，如失败请手动安装。*

#### Linux (Debian/Ubuntu)
- **依赖**:
```bash
sudo apt-get update
sudo apt-get install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```
- **命令**:
```bash
npm run tauri build
```
打包输出: AppImage 和 .deb 包。

## 推荐 IDE 设置

- [VS Code](https://code.visualstudio.com/)
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
