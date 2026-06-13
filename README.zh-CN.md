<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.svg">
  <img alt="reel-rando-mcp — 选择困难终结者" src=".github/assets/banner-light.svg" width="100%">
</picture>

[![CI](https://github.com/asashiki/reel-rando-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/asashiki/reel-rando-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-e96ba8.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A5%2020-8b8bef)
![MCP](https://img.shields.io/badge/MCP-stdio%20%2B%20Streamable%20HTTP-3a3340)

[English](README.md) · **简体中文**

</div>

# reel-rando-mcp

把"帮我随便选一个"变成好玩的瞬间。AI 不再只是列出几个选项让你自己纠结，而是直接在聊天里放一台**老虎机**、一个**幸运轮盘**或一组**抽卡**——你点一下，天意替你做决定。

> 「中午吃什么？」→ AI 把 麻辣烫 / 寿司 / 沙县 / 汉堡 放进老虎机 → 你拉一下 → 🎰 寿司。选择困难症一秒治好，还很有仪式感。

## 工作原理

- AI 调用 **`spin_picker`**，传入 2–12 个选项（可选 `title` 标题和 `mode` 模式）。
- 结果在**服务端**当场用 `crypto.randomInt` 抽好，放进 `structuredContent` 返回；工具说明同时叮嘱 AI **在你转之前不许剧透**。
- 对话里渲染出 `ui://` MCP Apps widget（claude.ai 和 ChatGPT 网页端）：你来交互，动画最终落在预定结果上——你和 AI 看到的答案永远一致。
- 想重抽？让 AI 再调一次就是新的一局（不做客户端假随机）。

## 三种模式

| 模式 | 适合 | 交互 |
|---|---|---|
| `slot`（默认） | 任意数量 | 竖直卷轴待机慢滚，大 SPIN 按钮，7 圈减速定格 |
| `wheel` | 3–8 个选项 | SVG 扇区轮盘，中央 GO 键，5 圈缓停 + 顶部指针 |
| `cards` | 2–6 个选项 | 背面卡牌阵，凭直觉点一张翻开，其余随后亮出 |

三种模式共用浅仪式（Asashiki）樱羽设计语言，自动跟随浅色/深色主题；揭晓后有 RESULT 斜切徽章、彩纸动效和可追溯的 drawId（服务器掷骰凭证）。

## 工具

`spin_picker`

```jsonc
{
  "title": "今天中午吃什么",       // 可选，≤40 字
  "options": ["麻辣烫", "寿司", "沙县", "汉堡"],  // 2-12 个短标签
  "mode": "slot"                   // 可选：slot | wheel | cards
}
```

返回 `structuredContent`：`{ title, options, mode, resultIndex, resultLabel, drawId, createdAt }`。

## 快速开始

```bash
npm install
npm run build
npm start            # Streamable HTTP，:3000（/mcp/reel，/mcp 别名，/healthz）
# 或 Claude Desktop 用 stdio：
npm run start:stdio
```

### Claude Desktop（stdio）配置

```json
{
  "mcpServers": {
    "reel-rando": {
      "command": "node",
      "args": ["path/to/reel-rando-mcp/dist/stdio.js"]
    }
  }
}
```

## 远程部署（连接 claude.ai / ChatGPT 网页端）

1. `cp .env.example .env`，设置 `PUBLIC_BASE_URL`（和 `ALLOWED_ORIGINS`）。
2. `docker compose up -d`。
3. 反向代理 `https://你的域名/mcp/reel` → 容器 `:3000`。
4. 在 claude.ai 添加自定义连接器填该 URL。如果设置了 `MCP_AUTH_PASSWORD`，连接器会走 OAuth 动态客户端注册，并弹出密码授权页。

widget 不加载任何外部资源（无字体、无图片、无 API 请求），CSP 白名单为空，除 MCP 路由外不需要转发任何东西——这是四个工具里部署最简单的一个。

> 宿主按 URI 缓存 `ui://` 资源。改过 widget 后记得升级 `src/widget/reel-widget-html.ts` 里的版本号（`widget-v1.html` → `v2` ……）。

## 配置项

| 变量 | 默认值 | 含义 |
|---|---|---|
| `PUBLIC_BASE_URL` | _(空)_ | 公网 HTTPS 域名（healthz 展示 + CORS 默认值）。 |
| `PORT` | `3000` | HTTP 端口。 |
| `MCP_HTTP_PATH` | `/mcp/reel` | Streamable HTTP MCP 路由。 |
| `ALLOWED_ORIGINS` | PUBLIC_BASE_URL 的 origin | CORS 白名单，逗号分隔。 |
| `MCP_AUTH_PASSWORD` | _(空)_ | 可选的远程连接器密码门禁。留空则关闭授权。 |

## OAuth 密码授权

设置 `MCP_AUTH_PASSWORD` 后，服务会启用一个最小 OAuth Authorization Code 流程，并暴露 OAuth discovery 与动态客户端注册端点。支持自动注册的客户端不需要手动填写 Client ID；连接时在授权页输入配置的密码即可。

## 开发

```bash
npm run dev          # HTTP 服务热重载
npm run typecheck
npm run build        # 服务端 (tsup) + widget（IIFE 内联进 ui:// 资源）
```

## 许可

MIT
