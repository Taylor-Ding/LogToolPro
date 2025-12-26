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

## 推荐 IDE 设置

- [VS Code](https://code.visualstudio.com/)
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
