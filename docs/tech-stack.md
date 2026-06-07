# 择书Zesoo — 技术方案

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 前端框架 | React + TypeScript | 19.x |
| 构建工具 | Vite | 8.x |
| CSS 框架 | Tailwind CSS | 4.x |
| 后端框架 | Python FastAPI | 0.115.x |
| 服务器 | Uvicorn | 0.34.x |
| AI 服务 | DeepSeek API | deepseek-chat |
| PDF 解析 | pdfplumber + PyPDF2 + DeepSeek Vision OCR | - |
| DOCX 解析 | python-docx | 1.1.x |
| DOCX 导出 | python-docx | 1.1.x |
| 进度推送 | SSE (sse-starlette) | 2.2.x |
| 部署 | Railway (前后端一体) | - |

## 项目结构

```
zesoo/
├── backend/                    # Python FastAPI 后端 + 静态文件
│   ├── main.py                 # API 入口 + SPA 静态文件服务
│   ├── config.py               # 配置（API Key 从 .env 加载）
│   ├── parser.py               # 文件解析（PDF/DOCX/TXT + OCR）
│   ├── ai_service.py           # DeepSeek API：章节检测 + 逐章分析
│   ├── export_service.py       # Word DOCX 导出
│   ├── requirements.txt        # Python 依赖
│   └── static/                 # 前端构建产物（部署用）
├── frontend/                   # React 前端源码
│   └── src/
│       ├── pages/              # UploadPage / ProgressPage / ReportPage
│       ├── components/         # FileDropZone / ProgressStepper / ReportSidebar / ReportContent
│       └── services/api.ts     # 后端 API 调用封装
├── docs/                       # 项目文档
├── devlog/                     # 开发日志
├── railway.toml                # Railway 部署配置
├── Procfile                    # Railway 启动命令
└── CLAUDE.md                   # Claude Code 工作指引
```

## 核心流程

```
用户上传文件 → 解析提取文本 → AI识别章节边界
    → 按章节切分 → 逐章独立深度分析
    → 组装报告 → 展示 + 导出Word
```

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload` | 上传文件，返回任务ID |
| GET | `/api/progress/{id}` | SSE 进度推送 |
| GET | `/api/report/{id}` | 获取报告 JSON |
| GET | `/api/export/{id}` | 下载 Word 文件 |

## 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | 是 |
