# Infinite Servers — Local Edition

一款基于 Node.js + SQLite 的服务器集群监控工具，完全本地运行，无需任何云服务账号。

## 功能特性

- 实时监控多台服务器的 CPU、内存、磁盘、网络等指标
- SSE 实时推送 + 轮询备份
- 历史数据存储与可视化
- 密码登录认证 + IP 封禁保护
- 到期提醒 + 离线告警（支持 Telegram 通知，可配置 Cron 和语言）
- IPv4 / IPv6 IP 地址遮罩脱敏
- IP 地理位置自动检测
- Google Doodle 随机展示
- 多语言支持（中文/英文）

## 快速开始

### 方式一：一键安装（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/zhojielun/infinite-servers/master/scripts/install-dashboard.sh | sudo bash
```

自定义端口：

```bash
curl -fsSL https://raw.githubusercontent.com/zhojielun/infinite-servers/master/scripts/install-dashboard.sh | sudo PORT=9090 bash
```

安装完成后：

```bash
# 启动服务
sudo systemctl start infinite-dashboard

# 查看状态
sudo systemctl status infinite-dashboard

# 查看日志
sudo journalctl -u infinite-dashboard -f
```

### 方式二：手动安装

```bash
# 克隆项目
git clone https://github.com/zhojielun/infinite-servers.git ~/infinite-servers
cd ~/infinite-servers

# 安装依赖
npm run setup

# 初始化数据库
npm run init

# 构建前端和后端（顺序很重要：先前端，后后端）
npm run build:web
npm run build

# 启动服务（开发模式）
npm run dev
```

服务将在 `http://localhost:8000` 启动。

### 方式三：Docker 部署

项目自带 `Dockerfile`（放在项目根目录）：

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY . .

RUN npm run setup
RUN npm run build:web
RUN npm run build

ENV PORT=8000
ENV HOST=0.0.0.0

EXPOSE 8000

CMD ["npm", "run", "dev"]
```

构建并运行：

```bash
# 构建镜像
docker build -t infinite-dashboard .

# 运行容器（默认端口 8000）
docker run -d --name infinite-dashboard -p 8000:8000 infinite-dashboard

# 自定义端口（例如使用 9090）
docker run -d --name infinite-dashboard -p 9090:8000 infinite-dashboard

# 挂载数据目录，持久化配置和数据库
docker run -d --name infinite-dashboard \
  -p 8000:8000 \
  -v $(pwd)/server/data:/app/server/data \
  infinite-dashboard
```

容器启动后访问 `http://localhost:8000`。

## Agent 部署

Agent 是安装在被监控服务器上的 Bash 脚本，用于采集系统信息并推送到 Dashboard。

### 一键安装

在被监控服务器上运行：

```bash
curl -fsSL https://raw.githubusercontent.com/zhojielun/infinite-servers/master/scripts/install-agent.sh | sudo bash
```

或使用环境变量：

```bash
sudo AGENT_NAME="My Server" DASHBOARD_URL="http://your-server:8000" \
     curl -fsSL https://raw.githubusercontent.com/zhojielun/infinite-servers/master/scripts/install-agent.sh | bash
```

### 安装参数

| 参数 | 环境变量 | 说明 | 示例 |
|------|----------|------|------|
| Server name | `AGENT_NAME` | 服务器名称，需与配置文件一致 | `My Server` |
| Dashboard URL | `DASHBOARD_URL` | 后端地址 | `http://your-server:8000` |
| Token | `AGENT_TOKEN` | 推送令牌，留空自动生成 | |
| Push interval | `AGENT_INTERVAL` | 上报间隔（秒），默认 15 | `15` |
| Report IP | `AGENT_REPORT_IP` | 是否上报公网 IP | `y` / `n` |
| Region | `AGENT_REGION` | 地区代码，留空自动检测 | `CN`、`US` |
| Location | `AGENT_LOCATION` | 位置名称，留空自动检测 | `Beijing` |

### 管理命令

```bash
# 查看状态
sudo systemctl status infinite-agent-My-Server

# 重启服务
sudo systemctl restart infinite-agent-My-Server

# 查看日志
sudo journalctl -u infinite-agent-My-Server -f
```

---

## 配置文件说明

### config.json（全局配置）

路径：`server/data/config.json`

```json
{
  "password": "admin123",
  "sse": false,
  "interval": 5,
  "history-interval": 1,
  "history-days": 30,
  "cors-origins": "*",
  "telegram": {
    "enabled": false,
    "bot_token": "",
    "chat_id": "",
    "cron": "0 0 * * *",
    "offline_check": "*/5 * * * *",
    "offline_threshold": 900,
    "notify_offline": false,
    "language": "en"
  }
}
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `password` | string | `""` | 登录密码，为空则跳过认证 |
| `sse` | boolean | `false` | 是否启用 SSE 实时推送 |
| `interval` | number | `5` | SSE 推送间隔（秒），范围 1-3600 |
| `history-interval` | number | `1` | 历史数据写入间隔（分钟），范围 0.5-1440 |
| `history-days` | number | `30` | 历史数据保留天数，范围 1-365 |
| `cors-origins` | string | `"*"` | CORS 允许的来源（逗号分隔） |
| `telegram.enabled` | boolean | `false` | 是否启用 Telegram 通知 |
| `telegram.bot_token` | string | `""` | Telegram Bot Token |
| `telegram.chat_id` | string | `""` | Telegram Chat ID |
| `telegram.cron` | string | `"0 0 * * *"` | 到期检查的 Cron 表达式 |
| `telegram.offline_check` | string | `"*/5 * * * *"` | 离线检查的 Cron 表达式 |
| `telegram.offline_threshold` | number | `900` | 离线判定阈值（秒），超过此时间未上报视为离线 |
| `telegram.notify_offline` | boolean | `false` | 是否启用离线告警 |
| `telegram.language` | string | `"en"` | 提醒语言（`en` 英文 / `zh` 中文） |

### servers.json（服务器列表）

路径：`server/data/servers.json`

```json
{
  "servers": {
    "My Server": {
      "token": "agent-token-here",
      "region": "CN",
      "location": "Beijing",
      "tags": ["Production"],
      "ip_mask": "x.x.*.*",
      "ip6_mask": "2001:0db8:*:*:*:*:*:*",
      "expiry": "2026-12-31",
      "purchase_date": "2025-01-01"
    }
  }
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `token` | string | 是 | Agent 推送令牌，每个服务器唯一 |
| `region` | string | 否 | 国家代码（如 `CN`、`US`），用于显示国旗，可自动检测 |
| `location` | string | 否 | 位置名称（如 `Beijing`），可自动检测 |
| `tags` | string[] | 否 | 标签数组，用于前端筛选 |
| `ip_mask` | string | 否 | IPv4 遮罩 |
| `ip6_mask` | string | 否 | IPv6 遮罩（可选，留空则使用 `ip_mask`） |
| `expiry` | string | 否 | 到期日期 `YYYY-MM-DD`，到期前会提醒 |
| `purchase_date` | string | 否 | 购买日期 `YYYY-MM-DD` |

#### IP 遮罩格式

`ip_mask` 用于 IPv4 遮罩，`ip6_mask` 用于 IPv6 遮罩。用 `*` 表示需要隐藏的部分。

**场景一：只需遮罩 IPv4**

```json
{ "ip_mask": "x.x.*.*" }
```

| 原始 IPv4 | 显示结果 |
|-----------|----------|
| `1.2.3.4` | `1.2.*.*` |
| `192.168.1.100` | `192.168.*.*` |

**场景二：只需遮罩 IPv6**

```json
{ "ip_mask": "2001:0db8:*:*:*:*:*:*" }
```

| 原始 IPv6 | 显示结果 |
|-----------|----------|
| `2001:0db8:85a3:0000:0000:8a2e:0370:7334` | `2001:0db8:*:*:*:*:*:*` |
| `2001:db8::1`（缩写格式） | `2001:db8:*:*:*:*:*:*` |

**场景三：IPv4 和 IPv6 遮罩不同**

```json
{
  "ip_mask": "192.168.*.*",
  "ip6_mask": "2001:0db8:*:*:*:*:*:*"
}
```

> `ip_mask` 对 IPv4 生效，`ip6_mask` 对 IPv6 生效。如果只设置了 `ip_mask` 且格式是 IPv6，则 IPv4 不会被遮罩。

### agent.json（Agent 配置）

路径：`/opt/infinite-servers/agents/{server-name}/agent.json`

```json
{
  "name": "My Server",
  "token": "your-token-here",
  "url": "http://your-server:8000/push",
  "interval": 15,
  "report_ip": "y",
  "region": "SG",
  "location": "Singapore"
}
```

| 参数 | 说明 |
|------|------|
| `name` | 服务器名称 |
| `token` | 推送令牌 |
| `url` | 推送地址 |
| `interval` | 推送间隔（秒） |
| `report_ip` | 是否上报公网 IP |
| `region` | 国家代码（可自动检测） |
| `location` | 位置名称（可自动检测） |

---

## API 端点

### 认证

| 端点 | 方法 | 说明 |
|------|------|------|
| `/login` | POST | 登录（form-urlencoded: `password=xxx`） |
| `/logout` | GET | 登出 |

### 数据查询

| 端点 | 方法 | 说明 |
|------|------|------|
| `/servers` | GET | 获取所有服务器硬件信息 |
| `/status` | GET | 获取所有服务器实时状态 |
| `/status?sse=1` | GET | SSE 实时推送 |
| `/history?server=<name>&hours=24` | GET | 获取历史数据 |
| `/availability?server=<name>&days=30` | GET | 获取可用性统计 |
| `/traffic` | GET | 获取所有服务器流量统计 |

### 数据推送

| 端点 | 方法 | 说明 |
|------|------|------|
| `/push` | POST | Agent 推送监控数据（form-urlencoded） |

### 设置操作

| 端点 | 方法 | 说明 |
|------|------|------|
| `/set-expiry` | POST | 设置服务器到期时间 |
| `/set-purchase-date` | POST | 设置服务器购买时间 |
| `/api/config` | GET/POST | 读取/更新全局配置 |
| `/api/servers` | GET/POST | 读取/更新服务器列表 |

### 其他

| 端点 | 方法 | 说明 |
|------|------|------|
| `/geo` | GET | 获取服务器出口 IP 地理位置 |
| `/doodle` | GET | 获取随机 Google Doodle 图片 |
| `/api/telegram-check` | POST | 立即触发 Telegram 到期提醒（清除通知标记并重新发送） |

---

## 项目结构

```
infinite-servers/
├── package.json              # 根配置
├── README.md                 # 本文档
├── Dockerfile                # Docker 部署
├── scripts/
│   ├── install-dashboard.sh  # Dashboard 一键安装脚本
│   └── install-agent.sh      # Agent 一键安装脚本
│
├── server/                   # 后端 (Node.js + Hono)
│   ├── src/
│   │   ├── index.ts          # 入口文件
│   │   ├── init.ts           # 初始化脚本
│   │   ├── types.ts          # 类型定义
│   │   ├── config.ts         # 配置读写
│   │   ├── db.ts             # 数据库操作
│   │   ├── auth.ts           # 认证逻辑
│   │   ├── validation.ts     # 输入验证
│   │   ├── audit.ts          # 审计日志
│   │   ├── rate-limit.ts     # 请求限流
│   │   ├── cron.ts           # 定时任务
│   │   ├── geo.ts            # IP 地理位置
│   │   └── routes/           # API 路由
│   └── data/                 # 运行时数据（gitignore）
│
├── web/                      # 前端 (React + Vite)
│   └── src/
│       ├── api.js            # 数据层
│       ├── dashboard.jsx     # 仪表盘
│       ├── detail.jsx        # 详情页
│       ├── settings.jsx      # 设置弹窗
│       ├── chrome.jsx        # 布局组件
│       └── i18n.jsx          # 国际化
│
└── dist/                     # 前端构建输出（Vite 输出到根目录）
```

---

## 数据库表结构

| 表名 | 说明 |
|------|------|
| `server_info` | 服务器硬件信息 |
| `server_status` | 服务器实时状态 |
| `history` | 历史监控数据 |
| `login_logs` | 登录日志 |
| `ip_bans` | IP 封禁记录 |
| `rate_limits` | 请求限流记录 |
| `audit_logs` | 操作审计日志 |

---

## 安全特性

- 密码支持明文和 SHA-256 加盐哈希
- Token 使用 AES-256-GCM 加密存储
- 连续 10 次登录失败，封禁 IP 30 天
- 请求限流：写 30 次/分钟，读 120 次/分钟
- 配置文件写入时进行 JSON Schema 验证
- 安全响应头（CSP、X-Frame-Options 等）
- 操作审计日志

---

## 常见问题

### Q: 如何配置 Telegram 通知？

**第一步：创建 Bot**

1. 在 Telegram 中搜索 `@BotFather`，发送 `/newbot`
2. 按提示设置 Bot 名称，获取 `bot_token`（格式如 `123456:ABC-DEF...`）
3. 将 Bot 添加到你的群组，获取 `chat_id`（群组 ID 通常是负数，如 `-1001234567890`）
   - 获取方式：向 `@userinfobot` 发送消息，或用 `https://api.telegram.org/bot<token>/getUpdates` 查看

**第二步：编辑配置文件**

编辑 `server/data/config.json`：

```json
{
  "telegram": {
    "enabled": true,
    "bot_token": "123456:ABC-DEF...",
    "chat_id": "-1001234567890",
    "language": "zh",
    "cron": "0 0 * * *",
    "notify_offline": false,
    "offline_check": "*/5 * * * *",
    "offline_threshold": 900
  }
}
```

**配置项说明：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `enabled` | `false` | 启用 Telegram 通知 |
| `bot_token` | `""` | Bot Token |
| `chat_id` | `""` | 群组/频道 Chat ID |
| `language` | `"en"` | 提醒语言：`zh` 中文 / `en` 英文 |
| `cron` | `"0 0 * * *"` | 到期检查的 Cron 表达式 |
| `notify_offline` | `false` | 启用离线告警 |
| `offline_check` | `"*/5 * * * *"` | 离线检查的 Cron 表达式 |
| `offline_threshold` | `900` | 离线判定阈值（秒） |

**Cron 表达式示例：**

| 表达式 | 含义 |
|--------|------|
| `0 0 * * *` | 每天 UTC 00:00（默认） |
| `0 9 * * *` | 每天 UTC 09:00（北京时间 17:00） |
| `0 */6 * * *` | 每 6 小时 |
| `*/5 * * * *` | 每 5 分钟（离线检查默认） |
| `0 0 * * 1` | 每周一 |

**到期提醒规则：**

- 到期前 7 天 ~ 过期后 4 天，每天发送一次提醒
- 消息带颜色球：🟡 提前 4~7 天 / 🟠 提前 1~3 天 / 🔴 当天或已过期
- 每天每个服务器只提醒一次，不会重复轰炸

**离线告警：**

设置 `notify_offline: true` 后，服务器超过阈值时间（默认 15 分钟）未上报数据，会发送离线告警。

**第三步：重启服务**

```bash
sudo systemctl restart infinite-dashboard
```

或手动重启：

```bash
cd ~/infinite-servers && npm run dev
```

### Q: 如何修改密码？

编辑 `server/data/config.json` 中的 `password` 字段，重启服务。

### Q: 如何添加新服务器？

1. 编辑 `server/data/servers.json`，添加服务器配置
2. 在被监控服务器上运行 `scripts/install-agent.sh`
3. 重启服务

### Q: 如何查看日志？

```bash
# 后端日志
sudo journalctl -u infinite-dashboard -f

# Agent 日志
sudo journalctl -u infinite-agent-{server-name} -f
```

### Q: 如何备份数据？

```bash
tar -czf backup.tar.gz server/data/
```

### Q: 如何升级？

```bash
cd ~/infinite-servers
git pull
npm run setup
npm run build:web
npm run build
sudo systemctl restart infinite-dashboard
```

---

## 服务管理

一键安装后，Dashboard 和 Agent 都通过 systemd 管理，支持开机自启和崩溃自动重启。

### Dashboard 服务

```bash
# 启动
sudo systemctl start infinite-dashboard

# 停止
sudo systemctl stop infinite-dashboard

# 重启
sudo systemctl restart infinite-dashboard

# 查看状态
sudo systemctl status infinite-dashboard

# 查看实时日志
sudo journalctl -u infinite-dashboard -f

# 开机自启
sudo systemctl enable infinite-dashboard

# 取消开机自启
sudo systemctl disable infinite-dashboard
```

### Agent 服务

```bash
# 启动
sudo systemctl start infinite-agent-{server-name}

# 停止
sudo systemctl stop infinite-agent-{server-name}

# 重启
sudo systemctl restart infinite-agent-{server-name}

# 查看状态
sudo systemctl status infinite-agent-{server-name}

# 查看实时日志
sudo journalctl -u infinite-agent-{server-name} -f

# 卸载 Agent
sudo systemctl stop infinite-agent-{server-name}
sudo systemctl disable infinite-agent-{server-name}
sudo rm -rf /opt/infinite-servers/agents/{server-name}
sudo rm /etc/systemd/system/infinite-agent-{server-name}.service
sudo systemctl daemon-reload
```

---

## License

MIT License
