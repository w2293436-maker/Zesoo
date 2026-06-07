# 择书Zesoo — 书籍精读报告生成器

上传 PDF / TXT / DOCX 书籍文件，AI（DeepSeek）自动生成包含章节脉络、核心观点、金句摘录、读后启示的精读报告，支持导出 Word 文档。

---

## 项目结构

```
lumcore-reader/
├── frontend/           # React 前端（页面 + 组件）
│   └── src/
│       ├── pages/      # 三个页面：上传 / 进度 / 报告
│       ├── components/ # 复用组件
│       └── services/   # API 调用封装
├── backend/            # Python FastAPI 后端
│   ├── main.py         # API 入口 + 路由
│   ├── parser.py       # PDF/DOCX/TXT 解析
│   ├── ai_service.py   # DeepSeek API + 文本分段
│   ├── export_service.py # Word 导出
│   └── config.py       # 配置文件
└── README.md
```

---

## 一、本地运行

### 前置要求

- **Python** 3.10+
- **Node.js** 18+
- **DeepSeek API Key**（去 [platform.deepseek.com](https://platform.deepseek.com) 注册获取，新用户有免费额度）

### 1. 配置 API Key

打开 `backend/config.py`，把第 4 行的 `your-deepseek-api-key-here` 替换为你的 DeepSeek API Key：

```python
DEEPSEEK_API_KEY = "sk-xxxxxxxxxxxxxxxxxx"  # 填你的 Key
```

> ⚠️ 不要把你的 API Key 发给别人或上传到公开仓库

### 2. 启动后端

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务（端口 8000）
uvicorn main:app --reload
```

启动后打开 http://localhost:8000/docs 可以看到 API 文档（Swagger）。

### 3. 启动前端

新开一个终端窗口：

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器（端口 5173）
npm run dev
```

打开浏览器访问 **http://localhost:5173** 即可使用。

---

## 二、使用流程

1. 打开网页 → 看到上传页面
2. 拖拽或点击上传 PDF / TXT / DOCX 文件
3. 点击「开始生成报告」
4. 等待 AI 分析（实时显示进度）
5. 报告生成后自动跳转到预览页
6. 左侧切换章节脉络 / 核心观点 / 金句摘录 / 启示建议
7. 点击右上角「导出 Word」下载 DOCX 文件

---

## 三、部署到公网

### 前端部署（Vercel，免费）

1. 注册 [vercel.com](https://vercel.com)（用 GitHub 账号登录）
2. 在 Vercel 中「New Project」→ 导入你的 GitHub 仓库
3. 选择 `lumcore-reader` 项目
4. Framework 选 **Vite**
5. Root Directory 填 `frontend`
6. 点击 Deploy

部署后会得到一个 `https://xxx.vercel.app` 的网址。

### 后端部署（Railway，有免费额度）

1. 注册 [railway.app](https://railway.app)（用 GitHub 账号登录）
2. 在 Railway 中「New Project」→「Deploy from GitHub repo」
3. 选择你的仓库
4. 添加环境变量：
   - `DEEPSEEK_API_KEY` = 你的 API Key
5. 设置 Root Directory 为 `backend`
6. Railway 会自动检测 `requirements.txt` 并安装依赖
7. 启动命令：`uvicorn main:app --host 0.0.0.0 --port $PORT`

部署后会得到一个 `https://xxx.up.railway.app` 的地址。

### 修改前端 API 地址

部署后端后，修改 `frontend/vite.config.ts` 中的 proxy target 为你的 Railway 地址：

```ts
proxy: {
  '/api': {
    target: 'https://你的服务.up.railway.app',  // 改成你的 Railway 地址
    changeOrigin: true,
  },
},
```

> 📌 如果只是个人用，不需要部署，本地 `npm run dev` 就行。需要别人也能用时再部署。

---

## 四、常见问题

**Q: PDF 上传后解析失败？**
A: 图片型/扫描件 PDF 无法直接提取文字（需要 OCR），请使用文字型 PDF。

**Q: 报告生成很慢？**
A: 大文件（几百页）需要分段处理，每段都要调用 AI，整个过程可能需要 2-5 分钟。进度条会实时显示。

**Q: API 调用要花多少钱？**
A: DeepSeek 非常便宜，处理一本 300 页的书大约花费 ¥0.1-0.3 人民币。新用户注册有免费额度。

**Q: 可以上传其他格式吗？**
A: 目前仅支持 PDF / TXT / DOCX。如果需要 EPUB 支持，可以先把 EPUB 转成 PDF 再上传。

---

## 五、技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite |
| CSS 框架 | Tailwind CSS 4 |
| 后端框架 | Python FastAPI |
| AI 服务 | DeepSeek API (deepseek-chat) |
| 文件解析 | PyPDF2 / python-docx |
| 实时进度 | Server-Sent Events (SSE) |
| 导出格式 | Word (python-docx) |
