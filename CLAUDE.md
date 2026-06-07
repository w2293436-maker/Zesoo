# CLAUDE.md — 择书Zesoo 工作指引

## 项目概述
**择书Zesoo** 是一款 AI 书籍精读报告生成工具（React + FastAPI + DeepSeek）。
上传 PDF/TXT/DOCX → AI 逐章分析 → 生成结构化报告 → 导出 Word。

## 标准文件路径

| 文档 | 路径 | 说明 |
|------|------|------|
| 开发需求 | [docs/requirements.md](docs/requirements.md) | 功能需求、非功能需求 |
| 技术方案 | [docs/tech-stack.md](docs/tech-stack.md) | 技术栈、项目结构、API 路由 |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) | 配色、字体、组件、页面布局 |
| 执行步骤 | [docs/implementation-steps.md](docs/implementation-steps.md) | 开发阶段、已完成/待办 |
| 开发日志 | [devlog/](devlog/) | 每日开发记录（YYYY-MM-DD.md） |

## 工作说明

### 日常开发
1. 每次开始工作前，在 [devlog/](devlog/) 创建当天日志文件（格式 `YYYY-MM-DD.md`）
2. 每次修改代码后，更新 [docs/implementation-steps.md](docs/implementation-steps.md) 的完成状态
3. 新功能开发前，先阅读 [docs/requirements.md](docs/requirements.md) 确认需求
4. UI 修改参考 [docs/design-spec.md](docs/design-spec.md) 的配色和组件规范

### 代码结构
- **后端**：[backend/](backend/) — FastAPI + DeepSeek + 文件解析 + 静态文件服务
- **前端**：[frontend/](frontend/) — React 19 + TypeScript + Tailwind CSS 4 + Vite 8

### 关键文件
- 后端入口：[backend/main.py](backend/main.py) — API 路由 + SPA 静态文件 + SSE 进度
- AI 服务：[backend/ai_service.py](backend/ai_service.py) — 章节检测 + 逐章分析
- 文件解析：[backend/parser.py](backend/parser.py) — PDF/DOCX/TXT + OCR
- 前端 API：[frontend/src/services/api.ts](frontend/src/services/api.ts) — API 调用封装
- 配置文件：[backend/config.py](backend/config.py) — 环境变量加载

### 环境变量
- `DEEPSEEK_API_KEY` — DeepSeek API 密钥（本地存 [backend/.env](backend/.env)，生产在 Railway Variables）

### 部署
- 生产环境：Railway（前后端一体）
- 部署命令：`cd backend && railway up`
- 构建产物：[backend/static/](backend/static/)（前端构建后复制到此处）

### 本地开发
```bash
# 后端
cd backend && uvicorn main:app --reload --port 8000

# 前端
cd frontend && npm run dev

# 访问 http://localhost:5173
```

### 技术约束
- Vercel CLI 不兼容中文 Windows 主机名，使用 Railway 一体化部署
- pdfplumber 优先于 PyPDF2（中文支持更好）
- 扫描件 PDF 通过 DeepSeek Vision API 做 OCR（需 API Key）
- 章节分析不限制提取数量（prompt 中禁止出现"3-5条"等限制）
