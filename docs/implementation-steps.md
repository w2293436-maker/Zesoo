# 择书Zesoo — 执行步骤记录

## 开发阶段

### 第一阶段：后端搭建 ✅
- [x] FastAPI 项目初始化
- [x] 文件解析模块（PDF/DOCX/TXT）
- [x] DeepSeek API 对接
- [x] 文本分段策略
- [x] SSE 进度推送

### 第二阶段：前端搭建 ✅
- [x] React + Vite + Tailwind CSS 初始化
- [x] 上传页（FileDropZone）
- [x] 进度页（ProgressStepper）
- [x] 报告页（ReportSidebar + ReportContent）

### 第三阶段：按章节重构 ✅
- [x] AI 章节检测 + 文本切分
- [x] 逐章深度分析（不限数量）
- [x] 报告结构改为 chapters[]
- [x] 新增方法论板块
- [x] 前端适配新结构

### 第四阶段：OCR 支持 ✅
- [x] DeepSeek Vision OCR（扫描件PDF）
- [x] pdfplumber + PyPDF2 双引擎

### 第五阶段：UI 打磨 ✅
- [x] 品牌命名：择书Zesoo
- [x] 自定义书本+星光图标
- [x] 手机响应式适配
- [x] 移动端侧边栏弹窗

### 第六阶段：部署上线 ✅
- [x] GitHub 仓库：w2293436-maker/Zesoo
- [x] Railway 部署（前后端一体）
- [x] 环境变量配置
- [x] 公网永久链接

## 部署地址
- **生产环境**：https://backend-production-e95b.up.railway.app

## 后续待办
- [ ] 自定义域名
- [ ] EPUB 格式支持
- [ ] 用户账号系统
- [ ] 报告历史记录
- [ ] 多语言报告
